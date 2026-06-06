import uuid
from decimal import Decimal, ROUND_DOWN
from typing import Optional, List, Tuple

from django.db import transaction, models
from django.utils import timezone

from apps.wallets.models import Wallet, WalletEntry


CENT = Decimal('0.01')


# =============================================================================
# Helpers
# =============================================================================

def _get_assoc_wallet_settings(association) -> dict:
    settings = (association.settings or {}).get('wallet', {})
    return {
        'auto_compensate_defaults': settings.get('auto_compensate_defaults', False),
        'compensation_sources': settings.get(
            'compensation_sources',
            ['auction_premium', 'loan_interest', 'sanction_payment'],
        ),
        'compensation_window': settings.get('compensation_window', 'current_session'),
        'rounding_target': settings.get('rounding_target', 'treasury'),
        'early_resignation_settlement': settings.get('early_resignation_settlement', False),
    }


def _subscribed_active_memberships(association, cycle, tontine_type=None):
    """
    Membres actifs ET souscrits (au cycle, optionnellement à une tontine_type).
    """
    from apps.members.models import Membership
    from apps.tontines.models import MemberSubscription

    qs = MemberSubscription.all_objects.filter(association=association, cycle=cycle)
    if tontine_type is not None:
        qs = qs.filter(tontine_type=tontine_type)

    membership_ids = list(qs.values_list('membership_id', flat=True))

    return Membership.all_objects.filter(
        id__in=membership_ids,
        association=association,
        is_active=True,
        status=Membership.Status.ACTIVE,
    ).order_by('id')


def _ensure_wallets(memberships) -> List[Wallet]:
    wallets = []
    for m in memberships:
        wallet, _ = Wallet.all_objects.get_or_create(
            membership=m,
            defaults={'association_id': m.association_id},
        )
        wallets.append(wallet)
    return wallets


def _round_down(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_DOWN)


def _split_amount(total: Decimal, n: int, rounding_target: str) -> Tuple[List[Decimal], Decimal]:
    """
    Divise `total` en `n` parts. Renvoie (parts, residue_non_distribué).
    rounding_target :
        - 'treasury' : reste en trésorerie (résidu non distribué).
        - 'first_member' : ajouté à la 1ʳᵉ part.
        - 'distribute' : un centime supplémentaire aux k premiers (k=residue/0.01).
    """
    if n <= 0:
        return [], total

    base = _round_down(total / Decimal(n))
    parts = [base] * n
    residue = total - base * Decimal(n)

    if residue <= 0:
        return parts, Decimal('0')

    if rounding_target == 'first_member':
        parts[0] = parts[0] + residue
        return parts, Decimal('0')

    if rounding_target == 'distribute':
        cents = int((residue / CENT).to_integral_value())
        for i in range(min(cents, n)):
            parts[i] = parts[i] + CENT
        consumed = CENT * Decimal(min(cents, n))
        return parts, residue - consumed

    return parts, residue


def _apply_to_wallet(
    wallet: Wallet, direction: str, amount: Decimal, *,
    source_type: str, source_id=None,
    session=None, cycle=None,
    distribution_batch=None,
    total_distributed: Decimal = Decimal('0'),
    members_count: int = 1,
    per_member_amount: Decimal = Decimal('0'),
    description: str = '',
) -> Optional[WalletEntry]:
    if amount <= 0 or wallet.is_frozen:
        return None

    signed = amount if direction == WalletEntry.Direction.CREDIT else -amount
    new_balance = wallet.balance + signed

    entry = WalletEntry.all_objects.create(
        association_id=wallet.association_id,
        wallet=wallet,
        direction=direction,
        amount=amount,
        source_type=source_type,
        source_id=source_id,
        session=session,
        cycle=cycle,
        distribution_batch=distribution_batch,
        total_distributed=total_distributed,
        members_count=members_count,
        per_member_amount=per_member_amount,
        description=description,
        balance_after=new_balance,
    )

    wallet.balance = new_balance
    if direction == WalletEntry.Direction.CREDIT:
        wallet.total_credits = wallet.total_credits + amount
    else:
        wallet.total_debits = wallet.total_debits + amount
    wallet.last_entry_at = timezone.now()
    wallet.save(update_fields=['balance', 'total_credits', 'total_debits', 'last_entry_at'])

    return entry


def _sum_total_distributed_unique_batches(qs) -> Decimal:
    """Somme `total_distributed` en dédoublonnant par `distribution_batch`."""
    rows = qs.values('distribution_batch', 'total_distributed').distinct()
    return sum((row['total_distributed'] or Decimal('0') for row in rows), Decimal('0'))


# =============================================================================
# WalletService — API publique
# =============================================================================

class WalletService:

    # -------------------------------------------------------------------------
    # Setup & lifecycle
    # -------------------------------------------------------------------------

    @staticmethod
    def ensure_wallet(membership) -> Wallet:
        wallet, _ = Wallet.all_objects.get_or_create(
            membership=membership,
            defaults={'association_id': membership.association_id},
        )
        return wallet

    @staticmethod
    def freeze_wallet(membership) -> Wallet:
        wallet = WalletService.ensure_wallet(membership)
        if not wallet.is_frozen:
            wallet.is_frozen = True
            wallet.save(update_fields=['is_frozen'])
        return wallet

    # -------------------------------------------------------------------------
    # Distributions positives
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def distribute_auction_premium(pot, premium_amount: Decimal, batch=None) -> dict:
        if premium_amount is None or premium_amount <= 0:
            return {'distributed': Decimal('0'), 'entries': []}

        association = pot.association
        cycle = pot.session.cycle
        memberships = list(_subscribed_active_memberships(association, cycle, pot.tontine_type))
        wallets = _ensure_wallets(memberships)
        n = len(wallets)
        if n == 0:
            return {'distributed': Decimal('0'), 'entries': []}

        cfg = _get_assoc_wallet_settings(association)
        parts, residue = _split_amount(premium_amount, n, cfg['rounding_target'])
        batch = batch or uuid.uuid4()

        won_bid = pot.bids.filter(status='won').first() if hasattr(pot, 'bids') else None
        source_id = won_bid.id if won_bid else None

        entries = []
        for wallet, part in zip(wallets, parts):
            e = _apply_to_wallet(
                wallet, WalletEntry.Direction.CREDIT, part,
                source_type=WalletEntry.Source.AUCTION_PREMIUM,
                source_id=source_id,
                session=pot.session, cycle=cycle,
                distribution_batch=batch,
                total_distributed=premium_amount,
                members_count=n,
                per_member_amount=part,
                description=f"Prime d'enchère — séance {pot.session.session_number}",
            )
            if e:
                entries.append(e)

        return {
            'distributed': premium_amount - residue,
            'residue': residue,
            'members_count': n,
            'batch': str(batch),
            'entries': entries,
        }

    @staticmethod
    @transaction.atomic
    def distribute_loan_interest(repayment, batch=None) -> dict:
        loan = repayment.loan
        if not loan or not loan.total_due or loan.total_due <= 0:
            return {'distributed': Decimal('0'), 'entries': []}
        total_interest = (loan.total_due or Decimal('0')) - (loan.amount or Decimal('0'))
        if total_interest <= 0 or repayment.amount <= 0:
            return {'distributed': Decimal('0'), 'entries': []}

        interest_portion = _round_down(
            (repayment.amount * total_interest) / loan.total_due
        )
        if interest_portion <= 0:
            return {'distributed': Decimal('0'), 'entries': []}

        association = repayment.association
        cycle = repayment.session.cycle if repayment.session else None
        memberships = list(_subscribed_active_memberships(association, cycle))
        wallets = _ensure_wallets(memberships)
        n = len(wallets)
        if n == 0:
            return {'distributed': Decimal('0'), 'entries': []}

        cfg = _get_assoc_wallet_settings(association)
        parts, residue = _split_amount(interest_portion, n, cfg['rounding_target'])
        batch = batch or uuid.uuid4()

        entries = []
        for wallet, part in zip(wallets, parts):
            e = _apply_to_wallet(
                wallet, WalletEntry.Direction.CREDIT, part,
                source_type=WalletEntry.Source.LOAN_INTEREST,
                source_id=repayment.id,
                session=repayment.session, cycle=cycle,
                distribution_batch=batch,
                total_distributed=interest_portion,
                members_count=n,
                per_member_amount=part,
                description=f"Intérêt prêt {loan.id}",
            )
            if e:
                entries.append(e)

        return {
            'distributed': interest_portion - residue,
            'interest_portion': interest_portion,
            'residue': residue,
            'members_count': n,
            'batch': str(batch),
            'entries': entries,
        }

    @staticmethod
    @transaction.atomic
    def distribute_sanction_payment(sanction, batch=None) -> dict:
        if sanction.status != sanction.Status.PAID or sanction.amount <= 0:
            return {'distributed': Decimal('0'), 'entries': []}

        association = sanction.association
        cycle = sanction.session.cycle if sanction.session else None
        memberships = list(_subscribed_active_memberships(association, cycle))
        wallets = _ensure_wallets(memberships)
        n = len(wallets)
        if n == 0:
            return {'distributed': Decimal('0'), 'entries': []}

        cfg = _get_assoc_wallet_settings(association)
        parts, residue = _split_amount(sanction.amount, n, cfg['rounding_target'])
        batch = batch or uuid.uuid4()

        entries = []
        for wallet, part in zip(wallets, parts):
            e = _apply_to_wallet(
                wallet, WalletEntry.Direction.CREDIT, part,
                source_type=WalletEntry.Source.SANCTION_PAYMENT,
                source_id=sanction.id,
                session=sanction.session, cycle=cycle,
                distribution_batch=batch,
                total_distributed=sanction.amount,
                members_count=n,
                per_member_amount=part,
                description=f"Sanction {sanction.sanction_type.name}",
            )
            if e:
                entries.append(e)

        return {
            'distributed': sanction.amount - residue,
            'residue': residue,
            'members_count': n,
            'batch': str(batch),
            'entries': entries,
        }

    # -------------------------------------------------------------------------
    # Débits
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def record_contribution_default(contribution) -> Optional[WalletEntry]:
        if contribution.status != contribution.Status.DEFAULTED:
            return None
        owed = (contribution.expected_amount or Decimal('0')) \
            - (contribution.paid_amount or Decimal('0'))
        if owed <= 0:
            return None

        wallet = WalletService.ensure_wallet(contribution.membership)
        return _apply_to_wallet(
            wallet, WalletEntry.Direction.DEBIT, owed,
            source_type=WalletEntry.Source.CONTRIBUTION_DEFAULT,
            source_id=contribution.id,
            session=contribution.session,
            cycle=contribution.session.cycle,
            total_distributed=owed,
            members_count=1,
            per_member_amount=owed,
            description=f"Cotisation impayée — séance {contribution.session.session_number}",
        )

    @staticmethod
    @transaction.atomic
    def distribute_expense(transaction_obj, batch=None) -> dict:
        if not getattr(transaction_obj, 'distribute_to_members', False):
            return {'distributed': Decimal('0'), 'entries': []}
        if transaction_obj.transaction_type != transaction_obj.TransactionType.EXPENSE:
            return {'distributed': Decimal('0'), 'entries': []}
        if transaction_obj.amount <= 0:
            return {'distributed': Decimal('0'), 'entries': []}

        association = transaction_obj.association
        cycle = transaction_obj.session.cycle if transaction_obj.session else None
        memberships = list(_subscribed_active_memberships(association, cycle))
        wallets = _ensure_wallets(memberships)
        n = len(wallets)
        if n == 0:
            return {'distributed': Decimal('0'), 'entries': []}

        cfg = _get_assoc_wallet_settings(association)
        parts, residue = _split_amount(transaction_obj.amount, n, cfg['rounding_target'])
        batch = batch or uuid.uuid4()

        entries = []
        for wallet, part in zip(wallets, parts):
            e = _apply_to_wallet(
                wallet, WalletEntry.Direction.DEBIT, part,
                source_type=WalletEntry.Source.EXPENSE,
                source_id=transaction_obj.id,
                session=transaction_obj.session, cycle=cycle,
                distribution_batch=batch,
                total_distributed=transaction_obj.amount,
                members_count=n,
                per_member_amount=part,
                description=transaction_obj.description or 'Dépense distribuée',
            )
            if e:
                entries.append(e)

        return {
            'distributed': transaction_obj.amount - residue,
            'residue': residue,
            'members_count': n,
            'batch': str(batch),
            'entries': entries,
        }

    # -------------------------------------------------------------------------
    # Compensation collective des défauts
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def compensate_defaults_for_session(session) -> dict:
        from apps.finance.models import Contribution

        association = session.association
        cfg = _get_assoc_wallet_settings(association)
        if not cfg['auto_compensate_defaults']:
            return {'compensated': Decimal('0'), 'entries': []}

        defaults_qs = Contribution.all_objects.filter(
            association=association, session=session,
            status=Contribution.Status.DEFAULTED,
        )
        total_default = sum(
            ((c.expected_amount or Decimal('0')) - (c.paid_amount or Decimal('0')))
            for c in defaults_qs
        )
        if total_default <= 0:
            return {'compensated': Decimal('0'), 'entries': []}

        cycle = session.cycle
        memberships = list(_subscribed_active_memberships(association, cycle))
        wallets = _ensure_wallets(memberships)
        n = len(wallets)
        if n == 0:
            return {'compensated': Decimal('0'), 'entries': []}

        # Fonds éligibles selon la fenêtre choisie
        if cfg['compensation_window'] == 'current_cycle':
            window_filter = {'cycle': cycle}
        else:
            window_filter = {'session': session}

        avail_qs = WalletEntry.all_objects.filter(
            association=association,
            direction=WalletEntry.Direction.CREDIT,
            source_type__in=cfg['compensation_sources'],
            **window_filter,
        )
        available = _sum_total_distributed_unique_batches(avail_qs)

        ac_qs = WalletEntry.all_objects.filter(
            association=association,
            source_type=WalletEntry.Source.DEFAULT_COMPENSATION,
            **window_filter,
        )
        already_compensated = _sum_total_distributed_unique_batches(ac_qs)

        usable = max(Decimal('0'), available - already_compensated)
        to_compensate = min(total_default, usable)
        if to_compensate <= 0:
            return {
                'compensated': Decimal('0'),
                'available': usable,
                'total_default': total_default,
                'entries': [],
            }

        parts, residue = _split_amount(to_compensate, n, cfg['rounding_target'])
        batch = uuid.uuid4()

        entries = []
        for wallet, part in zip(wallets, parts):
            e = _apply_to_wallet(
                wallet, WalletEntry.Direction.DEBIT, part,
                source_type=WalletEntry.Source.DEFAULT_COMPENSATION,
                source_id=session.id,
                session=session, cycle=cycle,
                distribution_batch=batch,
                total_distributed=to_compensate,
                members_count=n,
                per_member_amount=part,
                description=f"Compensation défaut(s) séance {session.session_number}",
            )
            if e:
                entries.append(e)

        return {
            'compensated': to_compensate - residue,
            'amount_target': to_compensate,
            'available': usable,
            'total_default': total_default,
            'residue': residue,
            'members_count': n,
            'batch': str(batch),
            'entries': entries,
        }

    # -------------------------------------------------------------------------
    # Orchestration à la clôture du pot
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def process_pot_closure(pot) -> dict:
        """
        Orchestre :
          1. Premium d'enchère (si bid gagnante)
          2. Intérêts des LoanRepayment de la séance
          3. Sanctions payées à la séance
          4. Défauts individuels
          5. Compensation collective si configurée
        Idempotent : on saute les sources déjà distribuées.
        """
        from apps.finance.models import Contribution, LoanRepayment
        from apps.sanctions.models import Sanction

        results = {
            'auction_premium': None,
            'loan_interests': [],
            'sanctions': [],
            'defaults': [],
            'compensation': None,
        }

        # 1. Premium d'enchère
        won = pot.bids.filter(status='won').first() if hasattr(pot, 'bids') else None
        if won and won.bid_amount and won.bid_amount > 0:
            already = WalletEntry.all_objects.filter(
                source_type=WalletEntry.Source.AUCTION_PREMIUM, source_id=won.id,
            ).exists()
            if not already:
                results['auction_premium'] = WalletService.distribute_auction_premium(
                    pot, won.bid_amount,
                )

        # 2. Intérêts
        for r in LoanRepayment.all_objects.filter(
            association=pot.association, session=pot.session,
        ):
            already = WalletEntry.all_objects.filter(
                source_type=WalletEntry.Source.LOAN_INTEREST, source_id=r.id,
            ).exists()
            if not already:
                results['loan_interests'].append(WalletService.distribute_loan_interest(r))

        # 3. Sanctions
        for s in Sanction.all_objects.filter(
            association=pot.association, session=pot.session,
            status=Sanction.Status.PAID,
        ):
            already = WalletEntry.all_objects.filter(
                source_type=WalletEntry.Source.SANCTION_PAYMENT, source_id=s.id,
            ).exists()
            if not already:
                results['sanctions'].append(WalletService.distribute_sanction_payment(s))

        # 4. Défauts individuels
        for c in Contribution.all_objects.filter(
            association=pot.association, session=pot.session,
            status=Contribution.Status.DEFAULTED,
        ):
            already = WalletEntry.all_objects.filter(
                source_type=WalletEntry.Source.CONTRIBUTION_DEFAULT, source_id=c.id,
            ).exists()
            if not already:
                e = WalletService.record_contribution_default(c)
                if e:
                    results['defaults'].append(e)

        # 5. Compensation collective
        results['compensation'] = WalletService.compensate_defaults_for_session(pot.session)

        return results

    # -------------------------------------------------------------------------
    # Ajustements & règlement
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def manual_adjustment(membership, direction: str, amount: Decimal,
                          description: str, by_membership=None,
                          session=None, cycle=None) -> WalletEntry:
        wallet = WalletService.ensure_wallet(membership)
        if direction not in (WalletEntry.Direction.CREDIT, WalletEntry.Direction.DEBIT):
            raise ValueError("Direction invalide.")
        return _apply_to_wallet(
            wallet, direction, amount,
            source_type=WalletEntry.Source.MANUAL_ADJUSTMENT,
            source_id=by_membership.id if by_membership else None,
            session=session, cycle=cycle,
            total_distributed=amount,
            members_count=1,
            per_member_amount=amount,
            description=description or "Ajustement manuel",
        )

    @staticmethod
    @transaction.atomic
    def recompute_balance(wallet) -> Wallet:
        agg = WalletEntry.all_objects.filter(wallet=wallet).aggregate(
            credits=models.Sum('amount', filter=models.Q(direction=WalletEntry.Direction.CREDIT)),
            debits=models.Sum('amount', filter=models.Q(direction=WalletEntry.Direction.DEBIT)),
        )
        credits = agg['credits'] or Decimal('0')
        debits = agg['debits'] or Decimal('0')
        wallet.total_credits = credits
        wallet.total_debits = debits
        wallet.balance = credits - debits
        wallet.save(update_fields=['total_credits', 'total_debits', 'balance'])
        return wallet

    @staticmethod
    def cycle_settlement(association, cycle) -> List[dict]:
        """Récap fin de cycle : pour chaque wallet, solde net sur ce cycle."""
        wallets = Wallet.all_objects.filter(
            association=association,
        ).select_related('membership__user')
        result = []
        for w in wallets:
            agg = WalletEntry.all_objects.filter(
                wallet=w, cycle=cycle,
            ).aggregate(
                credits=models.Sum('amount', filter=models.Q(direction=WalletEntry.Direction.CREDIT)),
                debits=models.Sum('amount', filter=models.Q(direction=WalletEntry.Direction.DEBIT)),
            )
            credits = agg['credits'] or Decimal('0')
            debits = agg['debits'] or Decimal('0')
            net = credits - debits
            result.append({
                'wallet_id': str(w.id),
                'membership_id': str(w.membership_id),
                'member_name': f"{w.membership.user.first_name} {w.membership.user.last_name}",
                'credits': credits,
                'debits': debits,
                'net': net,
                'direction': 'pay_to_member' if net > 0 else (
                    'owed_by_member' if net < 0 else 'balanced'
                ),
            })
        return result
