from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone


class PotDistributionService:
    """
    Service gerant la distribution de la cagnotte.

    La methode d'acquisition est TOUJOURS resolue depuis CycleTontineConfig.
    Le service l'injecte automatiquement dans le pot et les payouts.

    Flux :
    1. open_pot()      -> cree le pot, resout la methode depuis la config
    2. distribute()    -> verse aux beneficiaires (appelable N fois)
    3. process_auction() -> traite le cas enchere
    4. close_pot()     -> calcule le reliquat et reporte
    """

    @classmethod
    @transaction.atomic
    def open_pot(cls, session, tontine_type, override_method=None, override_reason=''):
        """
        Cree et initialise le pot d'une session.

        La methode est automatiquement heritee de CycleTontineConfig.
        Si override_method est fourni, il sera valide par la config.
        """
        from apps.cycles.models import SessionPot, CycleTontineConfig
        from apps.finance.models import Contribution
        from apps.tontines.models import TontineType

        # Les tontines en mode « banque scolaire » ne font pas de
        # distribution par séance — la restitution arrive à la clôture du cycle.
        if tontine_type.payout_pattern == TontineType.PayoutPattern.INDIVIDUAL_SAVINGS:
            raise ValueError(
                "Cette tontine fonctionne en épargne individuelle (banque "
                "scolaire). Aucune distribution n'a lieu pendant le cycle ; "
                "les restitutions sont générées automatiquement à la clôture."
            )

        # Config du cycle
        config = CycleTontineConfig.all_objects.get(
            cycle=session.cycle, tontine_type=tontine_type,
        )

        # Resoudre la methode effective
        effective_method = config.get_effective_method(override_method)
        is_overridden = (
            override_method is not None
            and override_method != config.default_method
        )

        # Collecte du jour
        total_collected = Contribution.all_objects.filter(
            session=session, tontine_type=tontine_type, status='paid',
        ).aggregate(
            total=models.Sum('paid_amount')
        )['total'] or Decimal('0')

        # Report de la session precedente
        carry_over = Decimal('0')
        previous_pot = None
        previous_session = session.cycle.sessions.filter(
            session_number=session.session_number - 1,
        ).first()

        if previous_session:
            previous_pot = SessionPot.all_objects.filter(
                session=previous_session,
                tontine_type=tontine_type,
                is_closed=True,
            ).first()
            if previous_pot:
                carry_over = previous_pot.remainder

        pot, _ = SessionPot.all_objects.update_or_create(
            association=session.association,
            session=session,
            tontine_type=tontine_type,
            defaults={
                'total_collected': total_collected,
                'carry_over_in': carry_over,
                'previous_pot': previous_pot,
                'effective_method': effective_method,
                'is_method_overridden': is_overridden,
                'override_reason': override_reason if is_overridden else '',
            },
        )

        return pot

    @classmethod
    @transaction.atomic
    def distribute_to_beneficiary(cls, pot, membership, shares_claimed=None):
        """
        Verse la tontine a un beneficiaire.

        La methode est AUTOMATIQUEMENT heritee du pot.
        Le membre choisit combien de noms il prend (ou prend tout par defaut).
        """
        from apps.cycles.models import BeneficiaryPayout
        from apps.tontines.models import MemberSubscription

        if pot.is_closed:
            raise ValueError("Ce pot est deja cloture.")

        # Verifier eligibilite
        cls._check_eligibility(pot, membership)

        # Souscription du membre
        subscription = MemberSubscription.all_objects.filter(
            membership=membership,
            tontine_type=pot.tontine_type,
            cycle=pot.session.cycle,
            is_active=True,
        ).first()

        if not subscription:
            raise ValueError(
                f"{membership.user.first_name} n'est pas souscrit a {pot.tontine_type.name}."
            )

        shares_total = subscription.num_shares
        if shares_claimed is None:
            shares_claimed = shares_total

        if shares_claimed > shares_total:
            raise ValueError(
                f"Ne peut pas prendre {shares_claimed} noms "
                f"(souscrit pour {shares_total})."
            )
        if shares_claimed < 1:
            raise ValueError("Doit prendre au moins 1 nom.")

        # Config
        config = cls._get_config(pot)
        if config and config.config:
            min_shares = config.config.get('min_claim_shares', 1)
            if shares_claimed < min_shares:
                raise ValueError(f"Minimum {min_shares} nom(s) requis.")

        # Calculer le montant
        remaining = pot.total_available - pot.total_distributed
        if remaining <= 0:
            raise ValueError("Plus de fonds disponibles dans ce pot.")

        amount = cls._calculate_payout_amount(pot, shares_claimed, remaining)

        # Creer le payout — methode heritee du pot
        payout = BeneficiaryPayout.objects.create(
            association=pot.association,
            pot=pot,
            membership=membership,
            shares_claimed=shares_claimed,
            shares_total=shares_total,
            amount=amount,
            acquisition_method=pot.effective_method,
            status=BeneficiaryPayout.Status.PAID,
            paid_at=timezone.now(),
        )

        # Mettre a jour le pot
        pot.total_distributed += amount
        pot.save(update_fields=['total_distributed'])

        # Ecriture comptable
        cls._record_transaction(pot, payout)

        return payout

    @classmethod
    @transaction.atomic
    def process_auction(cls, pot, winner_membership, bid_amount):
        """
        Traite une enchere gagnee.
        Le pot doit avoir effective_method='auction'.
        """
        from apps.cycles.models import AuctionBid, BeneficiaryPayout
        from apps.tontines.models import MemberSubscription

        if pot.effective_method != 'auction':
            raise ValueError(
                f"La methode de cette seance est '{pot.get_effective_method_display()}', "
                f"pas 'enchere'. Utilisez distribute_to_beneficiary()."
            )

        if pot.is_closed:
            raise ValueError("Ce pot est deja cloture.")

        remaining = pot.total_available - pot.total_distributed
        if remaining <= 0:
            raise ValueError("Plus de fonds disponibles.")

        subscription = MemberSubscription.all_objects.filter(
            membership=winner_membership,
            tontine_type=pot.tontine_type,
            cycle=pot.session.cycle,
        ).first()

        # Payout pour le gagnant
        payout = BeneficiaryPayout.objects.create(
            association=pot.association,
            pot=pot,
            membership=winner_membership,
            shares_claimed=subscription.num_shares if subscription else 1,
            shares_total=subscription.num_shares if subscription else 1,
            amount=remaining,
            acquisition_method='auction',
            status=BeneficiaryPayout.Status.PAID,
            paid_at=timezone.now(),
        )

        pot.total_distributed += remaining
        pot.save(update_fields=['total_distributed'])

        # Enchere gagnante
        winning_bid = AuctionBid.all_objects.filter(
            pot=pot, membership=winner_membership,
        ).order_by('-bid_amount').first()

        if winning_bid:
            winning_bid.status = AuctionBid.Status.WON
            winning_bid.resulting_payout = payout
            winning_bid.save()

            AuctionBid.all_objects.filter(pot=pot).exclude(
                id=winning_bid.id
            ).update(status=AuctionBid.Status.LOST)

        # Distribuer la prime d'enchere
        cls._handle_auction_premium(pot, bid_amount, winner_membership)

        # Ecriture comptable
        cls._record_transaction(pot, payout)

        return payout

    @classmethod
    def close_and_carry_over(cls, pot):
        """Cloture le pot. Le reliquat sera recupere au prochain open_pot."""
        if pot.is_closed:
            return pot.remainder
        pot.close_pot()
        return pot.remainder

    # ------------------------------------------------------------------
    # Methodes privees
    # ------------------------------------------------------------------

    @staticmethod
    def _get_config(pot):
        from apps.cycles.models import CycleTontineConfig
        return CycleTontineConfig.all_objects.filter(
            cycle=pot.session.cycle, tontine_type=pot.tontine_type,
        ).first()

    @classmethod
    def _check_eligibility(cls, pot, membership):
        """Verifie qu'un membre peut beneficier de la tontine."""
        from apps.cycles.models import BeneficiaryPayout, SessionAttendance, Session

        config = cls._get_config(pot)
        if not config or not config.config:
            return

        options = config.config

        # Deja beneficie dans ce cycle ?
        if options.get('exclude_already_benefited', False):
            already = BeneficiaryPayout.all_objects.filter(
                pot__session__cycle=pot.session.cycle,
                pot__tontine_type=pot.tontine_type,
                membership=membership,
                status='paid',
            ).exists()
            if already:
                raise ValueError(
                    f"{membership.user.first_name} a deja beneficie "
                    f"de {pot.tontine_type.name} ce cycle."
                )

        # Taux de presence
        min_rate = options.get('min_attendance_rate')
        if min_rate:
            total_sessions = Session.all_objects.filter(
                cycle=pot.session.cycle, status='completed',
            ).count()
            if total_sessions > 0:
                present = SessionAttendance.all_objects.filter(
                    session__cycle=pot.session.cycle,
                    membership=membership,
                    status__in=['present', 'late', 'represented'],
                ).count()
                rate = present / total_sessions
                if rate < min_rate:
                    pct = round(rate * 100)
                    min_pct = round(min_rate * 100)
                    raise ValueError(
                        f"Taux de presence insuffisant : {pct}% "
                        f"(minimum requis : {min_pct}%)."
                    )

        # Periode de grace
        grace = options.get('grace_period_sessions', 0)
        if grace > 0:
            sessions_since_join = Session.all_objects.filter(
                cycle=pot.session.cycle,
                date__gte=membership.joined_date,
                status='completed',
            ).count()
            if sessions_since_join < grace:
                raise ValueError(
                    f"Periode de grace : {sessions_since_join}/{grace} seances. "
                    f"Eligible apres {grace} seances."
                )

    @staticmethod
    def _calculate_payout_amount(pot, shares_claimed, remaining):
        """
        Montant = (noms pris / total noms souscrits) x cagnotte restante.
        """
        from apps.tontines.models import MemberSubscription

        total_shares = MemberSubscription.all_objects.filter(
            tontine_type=pot.tontine_type,
            cycle=pot.session.cycle,
            is_active=True,
        ).aggregate(
            total=models.Sum('num_shares')
        )['total'] or 1

        amount_per_share = remaining / Decimal(str(total_shares))
        amount = amount_per_share * shares_claimed

        return min(amount, remaining)

    @classmethod
    def _handle_auction_premium(cls, pot, bid_amount, membership):
        """Distribue la prime d'enchere selon la config."""
        from apps.finance.models import TreasuryAccount, Transaction

        config = cls._get_config(pot)
        if not config:
            return

        destination = config.auction_premium_destination
        bid = Decimal(str(bid_amount))

        treasury = TreasuryAccount.all_objects.filter(
            association=pot.association, is_active=True,
        ).first()

        if destination == 'treasury' and treasury:
            treasury.balance += bid
            treasury.save(update_fields=['balance'])
            Transaction.objects.create(
                association=pot.association,
                account=treasury,
                transaction_type='income',
                amount=bid,
                is_debit=False,
                balance_after=treasury.balance,
                description=f"Prime enchere — {membership.user.first_name}",
                session=pot.session,
                membership=membership,
            )

        elif destination == 'next_pot':
            pot.auction_premium_in += bid
            pot.save(update_fields=['auction_premium_in'])

        elif destination == 'split' and treasury:
            ratio = config.auction_premium_split_ratio
            to_pot = bid * ratio
            to_treasury = bid - to_pot

            pot.auction_premium_in += to_pot
            pot.save(update_fields=['auction_premium_in'])

            treasury.balance += to_treasury
            treasury.save(update_fields=['balance'])
            Transaction.objects.create(
                association=pot.association,
                account=treasury,
                transaction_type='income',
                amount=to_treasury,
                is_debit=False,
                balance_after=treasury.balance,
                description=f"Prime enchere (part caisse) — {membership.user.first_name}",
                session=pot.session,
                membership=membership,
            )

    @staticmethod
    def _record_transaction(pot, payout):
        """Ecriture comptable pour un versement de tontine."""
        from apps.finance.models import TreasuryAccount, Transaction

        treasury = TreasuryAccount.all_objects.filter(
            association=pot.association, is_active=True,
        ).first()
        if not treasury:
            return

        treasury.balance -= payout.amount
        treasury.save(update_fields=['balance'])

        Transaction.objects.create(
            association=pot.association,
            account=treasury,
            transaction_type='beneficiary_payout',
            amount=payout.amount,
            is_debit=True,
            balance_after=treasury.balance,
            description=(
                f"Tontine {pot.tontine_type.name} ({pot.get_effective_method_display()}) — "
                f"{payout.membership.user.first_name} "
                f"({payout.shares_claimed}/{payout.shares_total} noms)"
            ),
            session=pot.session,
            membership=payout.membership,
        )




from datetime import timedelta, date
from dateutil.relativedelta import relativedelta

from apps.cycles.models import Cycle, Session



def adjust_to_day(start_date: date, target_day: int):
    # target_day attendu en 0..6 (lundi..dimanche). On clamp pour tolérer.
    target_day = int(target_day) % 7
    delta = (target_day - start_date.weekday()) % 7
    return start_date + timedelta(days=delta)

def generate_sessions_for_cycle(cycle: Cycle):
    """
    Génère automatiquement les séances d'un cycle.
    No-op silencieux si les infos sont incomplètes (le bureau pourra créer
    les séances manuellement ensuite).
    """
    if not cycle.start_date or not cycle.end_date:
        return

    # default_session_day optionnel : si absent, on ne génère pas
    # (l'asso créera les séances à la demande)
    if cycle.default_session_day is None:
        return

    if cycle.session_frequency == Cycle.Frequency.CUSTOM:
        return  # géré séparément

    current_date = cycle.start_date

    sessions_to_create = []

    while current_date <= cycle.end_date:
        session_date = adjust_to_day(current_date, cycle.default_session_day)

        sessions_to_create.append(
            Session(
                association = cycle.association,
                cycle=cycle,
                date=session_date,
                start_time=cycle.default_session_time,
                location=cycle.default_session_location,
            )
        )

        # 🔁 appliquer fréquence
        if cycle.session_frequency == Cycle.Frequency.WEEKLY:
            current_date += timedelta(weeks=1)

        elif cycle.session_frequency == Cycle.Frequency.BIWEEKLY:
            current_date += timedelta(weeks=2)

        elif cycle.session_frequency == Cycle.Frequency.MONTHLY:
            current_date += relativedelta(months=1)

        elif cycle.session_frequency == Cycle.Frequency.QUARTERLY:
            current_date += relativedelta(months=3)

        else:
            break  # CUSTOM à gérer séparément

    Session.objects.bulk_create(sessions_to_create, ignore_conflicts=True)


# ==========================================================================
# RAPPORTS DE SEANCE
# ==========================================================================

class SessionReportService:
    """
    Service gerant les rapports individuels de seance ecrits par les
    membres du bureau (President, Tresorier, Secretaire...).

    A la publication d'un rapport, tous les membres actifs de l'association
    sont notifies.
    """

    @staticmethod
    @transaction.atomic
    def publish(report):
        """Marque un rapport comme publie et notifie les membres actifs."""
        if report.is_published:
            return report

        report.is_published = True
        report.published_at = timezone.now()
        report.save(update_fields=['is_published', 'published_at', 'updated_at'])

        SessionReportService._notify_members(report)
        return report

    @staticmethod
    @transaction.atomic
    def unpublish(report):
        """Repasse un rapport en brouillon."""
        if not report.is_published:
            return report
        report.is_published = False
        report.published_at = None
        report.save(update_fields=['is_published', 'published_at', 'updated_at'])
        return report

    @staticmethod
    def _notify_members(report):
        """Notifie tous les membres actifs de l'association."""
        from apps.members.models import Membership
        from apps.notifications.services import NotificationService

        association = report.session.association
        author = report.bureau_member
        position_name = author.position.name if author.position else 'Bureau'
        author_name = (
            f"{author.membership.user.first_name} "
            f"{author.membership.user.last_name}"
        ).strip() or position_name

        members = Membership.all_objects.filter(
            association=association, is_active=True,
        )

        title = f"Rapport de seance publie - {position_name}"
        body = (
            f"{author_name} ({position_name}) a publie son rapport pour la "
            f"seance n{report.session.session_number} du "
            f"{report.session.date}."
        )
        data = {
            'session_id': str(report.session_id),
            'report_id': str(report.id),
            'session_number': report.session.session_number,
            'session_date': str(report.session.date),
            'bureau_position': author.position.slug if author.position else '',
            'author_name': author_name,
        }

        for member in members:
            try:
                NotificationService.notify(
                    association=association,
                    recipient=member,
                    notification_type='session_report_published',
                    title=title,
                    body=body,
                    data=data,
                )
            except Exception:
                # On continue : ne pas bloquer la publication si une notif echoue
                continue


# ==========================================================================
# STATS CYCLE — pour le calendrier front
# ==========================================================================

def get_cycle_sessions_stats(cycle):
    """
    Retourne un dict avec le compteur de seances pour un cycle donne.
    Utilise par l'endpoint sessions-stats pour alimenter le calendrier.
    """
    from apps.cycles.models import Session

    sessions = Session.all_objects.filter(cycle=cycle).order_by('date')

    counts = {s.value: 0 for s in Session.Status}
    for session in sessions:
        counts[session.status] += 1

    total = sessions.count()
    completed = counts[Session.Status.COMPLETED]
    cancelled = counts[Session.Status.CANCELLED]
    remaining = (
        counts[Session.Status.SCHEDULED]
        + counts[Session.Status.IN_PROGRESS]
        + counts[Session.Status.POSTPONED]
    )

    progress = (
        round((completed / (total - cancelled)) * 100, 2)
        if (total - cancelled) > 0 else 0
    )

    today = timezone.now().date()
    next_session = sessions.filter(
        status__in=[Session.Status.SCHEDULED, Session.Status.POSTPONED],
        date__gte=today,
    ).order_by('date').first()
    last_session = sessions.filter(
        status=Session.Status.COMPLETED,
    ).order_by('-date').first()

    return {
        'cycle_id': str(cycle.id),
        'cycle_name': cycle.name,
        'cycle_status': cycle.status,
        'total_sessions': total,
        'completed': completed,
        'remaining': remaining,
        'in_progress': counts[Session.Status.IN_PROGRESS],
        'scheduled': counts[Session.Status.SCHEDULED],
        'cancelled': cancelled,
        'postponed': counts[Session.Status.POSTPONED],
        'progress_percentage': progress,
        'next_session': _session_brief(next_session),
        'last_session': _session_brief(last_session),
        'sessions': [_session_brief(s) for s in sessions],
    }


def _session_brief(session):
    if session is None:
        return None
    return {
        'id': str(session.id),
        'session_number': session.session_number,
        'date': session.date.isoformat(),
        'start_time': session.start_time.isoformat() if session.start_time else None,
        'end_time': session.end_time.isoformat() if session.end_time else None,
        'location': session.location,
        'status': session.status,
    }