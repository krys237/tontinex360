"""
Services finance — fonds virtuels par type de cotisation.

Le modèle est « bucket virtuel » : les caisses physiques (TreasuryAccount)
indiquent OÙ est l'argent ; le tag tontine_type sur Transaction indique
À QUI il appartient. La somme des soldes virtuels = la somme des soldes
physiques. Voir la stratégie complète dans la doc projet.
"""
from decimal import Decimal
from django.db import transaction as db_transaction
from django.db.models import Sum, Q


class FundBalanceError(Exception):
    """Levée quand une transaction ferait passer un fonds en négatif."""
    pass


class TontineFundService:
    """Solde virtuel par type de cotisation (fonds)."""

    @staticmethod
    def balance(tontine_type) -> Decimal:
        """Solde courant du fonds (crédits − débits)."""
        from apps.finance.models import Transaction
        agg = Transaction.all_objects.filter(
            association=tontine_type.association,
            tontine_type=tontine_type,
        ).aggregate(
            credits=Sum('amount', filter=Q(is_debit=False)),
            debits=Sum('amount', filter=Q(is_debit=True)),
        )
        return (agg['credits'] or Decimal('0')) - (agg['debits'] or Decimal('0'))

    @staticmethod
    def balances_for_association(association):
        """Renvoie [(tontine_type, balance, credits, debits), ...]"""
        from apps.tontines.models import TontineType
        from apps.finance.models import Transaction

        types = TontineType.all_objects.filter(association=association).order_by('display_order', 'name')
        result = []
        for tt in types:
            agg = Transaction.all_objects.filter(
                association=association, tontine_type=tt,
            ).aggregate(
                credits=Sum('amount', filter=Q(is_debit=False)),
                debits=Sum('amount', filter=Q(is_debit=True)),
            )
            credits = agg['credits'] or Decimal('0')
            debits = agg['debits'] or Decimal('0')
            result.append({
                'tontine_type_id': str(tt.id),
                'name': tt.name,
                'slug': tt.slug,
                'currency': tt.currency,
                'credits': credits,
                'debits': debits,
                'balance': credits - debits,
            })
        return result

    @staticmethod
    def unassigned_balance(association) -> Decimal:
        """Solde des transactions non affectées (tontine_type=null)."""
        from apps.finance.models import Transaction
        agg = Transaction.all_objects.filter(
            association=association, tontine_type__isnull=True,
        ).aggregate(
            credits=Sum('amount', filter=Q(is_debit=False)),
            debits=Sum('amount', filter=Q(is_debit=True)),
        )
        return (agg['credits'] or Decimal('0')) - (agg['debits'] or Decimal('0'))

    @staticmethod
    @db_transaction.atomic
    def create_transaction(
        *, association, account, tontine_type=None,
        transaction_type, amount, is_debit, description='',
        session=None, membership=None, recorded_by=None,
        reference='', distribute_to_members=False,
        allow_overdraft=False,
        in_kind_quantity=None, in_kind_unit_label='',
    ):
        """
        Crée une transaction en vérifiant la règle "fonds non négatif"
        (sauf si allow_overdraft=True).

        Lock pessimiste sur les transactions du fonds pour éviter les
        races en concurrence.
        """
        from apps.finance.models import Transaction, TreasuryAccount

        if is_debit and tontine_type and not allow_overdraft:
            # Vérification atomique : lock sur les lignes du fonds
            locked = Transaction.all_objects.select_for_update().filter(
                association=association, tontine_type=tontine_type,
            ).aggregate(
                credits=Sum('amount', filter=Q(is_debit=False)),
                debits=Sum('amount', filter=Q(is_debit=True)),
            )
            current = (locked['credits'] or Decimal('0')) - (locked['debits'] or Decimal('0'))
            if current < amount:
                raise FundBalanceError(
                    f"Solde insuffisant pour le fonds « {tontine_type.name} » : "
                    f"disponible {current}, demandé {amount}."
                )

        # Calculer balance_after sur la caisse physique
        last = Transaction.all_objects.filter(
            association=association, account=account,
        ).order_by('-created_at').first()
        previous = last.balance_after if last else (account.balance or Decimal('0'))
        balance_after = previous + (amount if not is_debit else -amount)

        tx = Transaction.all_objects.create(
            association=association,
            account=account,
            tontine_type=tontine_type,
            transaction_type=transaction_type,
            amount=amount,
            is_debit=is_debit,
            balance_after=balance_after,
            description=description,
            reference=reference,
            session=session,
            membership=membership,
            recorded_by=recorded_by,
            distribute_to_members=distribute_to_members,
            in_kind_quantity=in_kind_quantity,
            in_kind_unit_label=in_kind_unit_label or '',
        )

        # Mettre à jour le solde de la caisse physique
        account.balance = balance_after
        account.save(update_fields=['balance'])

        return tx


class ContributionPaymentService:
    """
    Comptabilisation du paiement d'une cotisation.

    Règles :
    - **Idempotent** : référence unique `contribution:<id>` ; un 2ᵉ appel
      retourne la transaction existante (jamais de doublon).
    - **Une seule** Transaction de type CONTRIBUTION par Contribution.
      Tout ajustement ultérieur passe par le workflow de correction
      (qui crée une transaction d'ajustement séparée).
    - Caisse cible : argument `account` explicite, sinon mapping basé sur
      `payment_method`, sinon première caisse `cash` active de l'association.
    """

    REFERENCE_PREFIX = 'contribution:'

    PAYMENT_METHOD_TO_ACCOUNT_TYPE = {
        'cash': 'cash',
        'mobile_money': 'mobile_money',
        'mobile': 'mobile_money',
        'momo': 'mobile_money',
        'om': 'mobile_money',
        'bank': 'bank',
        'virement': 'bank',
        'cheque': 'bank',
    }

    @classmethod
    def reference_for(cls, contribution) -> str:
        return f"{cls.REFERENCE_PREFIX}{contribution.id}"

    @classmethod
    def existing_transaction(cls, contribution):
        from apps.finance.models import Transaction
        return Transaction.all_objects.filter(
            association=contribution.association,
            reference=cls.reference_for(contribution),
            transaction_type=Transaction.TransactionType.CONTRIBUTION,
        ).first()

    @classmethod
    def _resolve_account(cls, contribution, account=None):
        if account is not None:
            return account
        from apps.finance.models import TreasuryAccount
        target_type = cls.PAYMENT_METHOD_TO_ACCOUNT_TYPE.get(
            (contribution.payment_method or '').lower(),
        )
        qs = TreasuryAccount.all_objects.filter(
            association=contribution.association, is_active=True,
        )
        if target_type:
            match = qs.filter(account_type=target_type).first()
            if match:
                return match
        # Fallback : première caisse active (préférence cash)
        cash = qs.filter(account_type=TreasuryAccount.AccountType.CASH).first()
        return cash or qs.first()

    @classmethod
    @db_transaction.atomic
    def record_payment(cls, contribution, *, recorded_by=None, account=None):
        """
        Crée la Transaction comptable correspondant au paiement de cette cotisation.
        Idempotent : si déjà fait, retourne la transaction existante sans rien créer.

        En mode `in_kind` :
        - `paid_amount` représente la **quantité** d'unités collectée (ex: 3 sacs)
        - On calcule le montant XAF équivalent via `unit_value × quantité`
        - La Transaction stocke à la fois `amount` (XAF équivalent pour reporting)
          et `in_kind_quantity` (la vraie quantité) + `in_kind_unit_label`
        """
        from apps.finance.models import Transaction
        from decimal import Decimal

        if contribution.paid_amount is None or contribution.paid_amount <= 0:
            return None

        existing = cls.existing_transaction(contribution)
        if existing:
            return existing

        account = cls._resolve_account(contribution, account)
        if account is None:
            raise ValueError(
                "Aucune caisse de trésorerie active disponible pour comptabiliser ce paiement."
            )

        member_name = ''
        try:
            user = contribution.membership.user
            member_name = f"{user.first_name} {user.last_name}".strip()
        except Exception:
            pass
        tontine = contribution.tontine_type
        tontine_name = getattr(tontine, 'name', '')
        try:
            session_number = contribution.session.session_number
        except Exception:
            session_number = ''

        # ── Détection du mode in_kind ──────────────────────────────
        is_in_kind = getattr(tontine, 'contribution_kind', 'cash') == 'in_kind'
        in_kind_quantity = None
        in_kind_unit_label = ''
        xaf_amount = Decimal(contribution.paid_amount)

        if is_in_kind:
            in_kind_quantity = Decimal(contribution.paid_amount)
            in_kind_unit_label = getattr(tontine, 'in_kind_unit_label', '') or ''
            unit_value = getattr(tontine, 'in_kind_unit_value', None) or Decimal('0')
            xaf_amount = in_kind_quantity * Decimal(unit_value)

        unit_suffix = (
            f" ({in_kind_quantity} {in_kind_unit_label})"
            if is_in_kind and in_kind_unit_label else ''
        )
        description = (
            f"Cotisation {member_name} — {tontine_name}"
            + (f" — Séance n°{session_number}" if session_number else '')
            + unit_suffix
        ).strip()

        return TontineFundService.create_transaction(
            association=contribution.association,
            account=account,
            tontine_type=contribution.tontine_type,
            transaction_type=Transaction.TransactionType.CONTRIBUTION,
            amount=xaf_amount,
            is_debit=False,
            description=description,
            session=contribution.session,
            membership=contribution.membership,
            recorded_by=recorded_by,
            reference=cls.reference_for(contribution),
            allow_overdraft=True,
            in_kind_quantity=in_kind_quantity,
            in_kind_unit_label=in_kind_unit_label,
        )
