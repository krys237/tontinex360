"""
Service de gestion des frais d'adhésion (inscription + fond de membre).

Configuration au niveau Association.settings.membership_fees :
{
  "registration": {
    "enabled": true,
    "amount": 5000,
    "is_entry_gate": true       // bloque l'activation tant que pas payé
  },
  "membership_fund": {
    "enabled": true,
    "amount": 50000,
    "scope": "lifetime",        // 'lifetime' | 'per_cycle'
    "allow_partial": true,
    "blocks_access": false      // false = membre peut tout faire, juste solde négatif visible
  }
}

Sémantique :
- inscription `is_entry_gate=true` → Membership créé en `status='pending'`.
  Le membre ne peut pas voter, cotiser, recevoir de tontine. Bascule en
  `active` dès que la dette d'inscription est à 0.
- fond de membre → indépendant du statut. Solde négatif dans le wallet
  visible jusqu'à régularisation.
- waived → équivalent à payé (status='waived'), mais zéro flux comptable.
"""
from decimal import Decimal
from django.db import transaction as db_transaction
from django.utils import timezone


DEFAULT_CONFIG = {
    "registration": {
        "enabled": False,
        "amount": 0,
        "is_entry_gate": False,
    },
    "membership_fund": {
        "enabled": False,
        "amount": 0,
        "scope": "lifetime",
        "allow_partial": True,
        "blocks_access": False,
    },
}


def get_config(association) -> dict:
    """Retourne la config des frais (avec défauts si non définis)."""
    raw = (association.settings or {}).get("membership_fees", {})
    cfg = {
        "registration": {**DEFAULT_CONFIG["registration"], **(raw.get("registration") or {})},
        "membership_fund": {**DEFAULT_CONFIG["membership_fund"], **(raw.get("membership_fund") or {})},
    }
    return cfg


def set_config(association, new_config: dict):
    """Met à jour la config (merge avec l'existant)."""
    settings = dict(association.settings or {})
    current = settings.get("membership_fees", {})
    settings["membership_fees"] = {
        "registration": {
            **current.get("registration", {}),
            **(new_config.get("registration") or {}),
        },
        "membership_fund": {
            **current.get("membership_fund", {}),
            **(new_config.get("membership_fund") or {}),
        },
    }
    association.settings = settings
    association.save(update_fields=["settings"])
    return get_config(association)


def required_fee_types(association) -> list[str]:
    """Liste des fee_types activés dans la config."""
    cfg = get_config(association)
    out = []
    if cfg["registration"].get("enabled"):
        out.append("registration")
    if cfg["membership_fund"].get("enabled"):
        out.append("membership_fund")
    return out


# ─── Création des FeePayment pour un nouveau membre ─────────────────


@db_transaction.atomic
def create_initial_fees(membership, *, current_cycle=None, mark_as_paid=False):
    """
    Crée les MembershipFeePayment requis par la config de l'association
    pour un nouveau membre (ou un membre invité).

    - `current_cycle` : utilisé pour le fond `per_cycle`
    - `mark_as_paid=True` : marque tous les frais comme `paid` (cas où le
      président invite un membre déjà à jour)

    Retourne la liste des FeePayment créés.
    """
    from apps.members.models import MembershipFeePayment

    cfg = get_config(membership.association)
    created = []

    # Inscription (one-shot)
    reg = cfg["registration"]
    if reg.get("enabled") and Decimal(reg.get("amount", 0)) > 0:
        already = MembershipFeePayment.all_objects.filter(
            association=membership.association,
            membership=membership,
            fee_type=MembershipFeePayment.FeeType.REGISTRATION,
        ).first()
        if not already:
            fp = MembershipFeePayment.all_objects.create(
                association=membership.association,
                membership=membership,
                fee_type=MembershipFeePayment.FeeType.REGISTRATION,
                expected_amount=Decimal(reg["amount"]),
                paid_amount=(
                    Decimal(reg["amount"]) if mark_as_paid else Decimal("0")
                ),
                status=(
                    MembershipFeePayment.Status.PAID if mark_as_paid
                    else MembershipFeePayment.Status.PENDING
                ),
                completed_at=timezone.now() if mark_as_paid else None,
            )
            created.append(fp)

    # Fond de membre
    fund = cfg["membership_fund"]
    if fund.get("enabled") and Decimal(fund.get("amount", 0)) > 0:
        scope = fund.get("scope", "lifetime")
        cycle = current_cycle if scope == "per_cycle" else None
        already = MembershipFeePayment.all_objects.filter(
            association=membership.association,
            membership=membership,
            fee_type=MembershipFeePayment.FeeType.MEMBERSHIP_FUND,
            cycle=cycle,
        ).first()
        if not already:
            fp = MembershipFeePayment.all_objects.create(
                association=membership.association,
                membership=membership,
                fee_type=MembershipFeePayment.FeeType.MEMBERSHIP_FUND,
                cycle=cycle,
                expected_amount=Decimal(fund["amount"]),
                paid_amount=(
                    Decimal(fund["amount"]) if mark_as_paid else Decimal("0")
                ),
                status=(
                    MembershipFeePayment.Status.PAID if mark_as_paid
                    else MembershipFeePayment.Status.PENDING
                ),
                completed_at=timezone.now() if mark_as_paid else None,
            )
            created.append(fp)

    return created


# ─── Enregistrement d'un versement ──────────────────────────────────


@db_transaction.atomic
def record_payment(*, fee_payment, amount, recorded_by=None,
                   payment_method='', notes='', account=None):
    """
    Enregistre un versement (partiel ou complet) sur un MembershipFeePayment.

    Crée :
    - Une `MembershipFeeInstallment` (audit trail du versement)
    - Une `Transaction` comptable (crédit caisse)
    - Une `WalletEntry` (debit du membre — son solde reste négatif tant que
      le total des dettes excède les crédits)

    Met à jour le FeePayment (paid_amount, status, completed_at).
    Si l'inscription d'entrée est complétée → bascule Membership.status='active'.
    """
    from apps.members.models import (
        MembershipFeePayment, MembershipFeeInstallment, Membership,
    )
    from apps.finance.models import Transaction, TreasuryAccount
    from apps.finance.services import TontineFundService
    from apps.wallets.models import Wallet, WalletEntry

    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Le montant du versement doit être positif.")

    fp = MembershipFeePayment.all_objects.select_for_update().get(pk=fee_payment.id)
    if fp.status in (MembershipFeePayment.Status.PAID, MembershipFeePayment.Status.WAIVED):
        raise ValueError("Ce frais est déjà soldé.")

    remaining = fp.remaining_amount
    if amount > remaining:
        raise ValueError(
            f"Le montant ({amount}) dépasse le restant dû ({remaining})."
        )

    # 1. Résoudre la caisse cible
    if account is None:
        account = TreasuryAccount.all_objects.filter(
            association=fp.association, is_active=True,
            account_type=TreasuryAccount.AccountType.CASH,
        ).first() or TreasuryAccount.all_objects.filter(
            association=fp.association, is_active=True,
        ).first()
    if account is None:
        raise ValueError("Aucune caisse active disponible.")

    # 2. Créer la Transaction comptable (crédit caisse)
    fee_type_label = fp.get_fee_type_display()
    member_label = ''
    try:
        u = fp.membership.user
        member_label = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone
    except Exception:
        pass
    description = f"{fee_type_label} — {member_label}".strip(" —")

    tx = TontineFundService.create_transaction(
        association=fp.association,
        account=account,
        tontine_type=None,  # frais d'adhésion ≠ tontine
        transaction_type=Transaction.TransactionType.INCOME,
        amount=amount,
        is_debit=False,  # entrée d'argent
        description=description,
        membership=fp.membership,
        recorded_by=recorded_by,
        reference=f"membership_fee:{fp.id}",
        allow_overdraft=True,
    )

    # 3. Créer la WalletEntry (crédit du membre — réduit son ardoise)
    wallet, _ = Wallet.all_objects.get_or_create(
        membership=fp.membership,
        defaults={'association_id': fp.association_id},
    )
    new_balance = wallet.balance + amount  # crédit, le solde augmente vers 0
    entry = WalletEntry.all_objects.create(
        association_id=wallet.association_id,
        wallet=wallet,
        direction=WalletEntry.Direction.CREDIT,
        amount=amount,
        source_type=WalletEntry.Source.MEMBERSHIP_FEE,
        source_id=fp.id,
        description=description,
        balance_after=new_balance,
    )
    wallet.balance = new_balance
    wallet.total_credits = wallet.total_credits + amount
    wallet.last_entry_at = timezone.now()
    wallet.save(update_fields=['balance', 'total_credits', 'last_entry_at'])

    # 4. Créer l'audit trail
    installment = MembershipFeeInstallment.all_objects.create(
        association=fp.association,
        payment=fp,
        amount=amount,
        paid_at=timezone.now(),
        payment_method=payment_method,
        recorded_by=recorded_by,
        transaction_id=tx.id,
        wallet_entry_id=entry.id,
        notes=notes,
    )

    # 5. Mettre à jour le FeePayment
    fp.paid_amount = fp.paid_amount + amount
    if fp.first_payment_at is None:
        fp.first_payment_at = timezone.now()
    if fp.paid_amount >= fp.expected_amount:
        fp.status = MembershipFeePayment.Status.PAID
        fp.completed_at = timezone.now()
    else:
        fp.status = MembershipFeePayment.Status.PARTIAL
    fp.save(update_fields=[
        'paid_amount', 'status', 'first_payment_at', 'completed_at', 'updated_at',
    ])

    # 6. Si entry_gate complétée → activer le membre
    if fp.status == MembershipFeePayment.Status.PAID:
        maybe_activate_membership(fp.membership)

    return {
        'fee_payment': fp,
        'installment': installment,
        'transaction': tx,
        'wallet_entry': entry,
    }


# ─── Activation automatique du membre ───────────────────────────────


def maybe_activate_membership(membership):
    """
    Active le membre si toutes les conditions d'entry_gate sont satisfaites.
    Idempotent : ne fait rien si le membre est déjà actif.
    """
    from apps.members.models import Membership, MembershipFeePayment

    if membership.status == Membership.Status.ACTIVE:
        return False

    cfg = get_config(membership.association)
    reg = cfg["registration"]
    # Seule l'inscription est entry gate par défaut (le fond ne bloque pas)
    if reg.get("enabled") and reg.get("is_entry_gate"):
        reg_fp = MembershipFeePayment.all_objects.filter(
            membership=membership,
            fee_type=MembershipFeePayment.FeeType.REGISTRATION,
        ).first()
        if reg_fp and reg_fp.status not in (
            MembershipFeePayment.Status.PAID, MembershipFeePayment.Status.WAIVED,
        ):
            return False  # inscription pas payée → reste pending

    # Toutes les conditions sont OK → activer
    membership.status = Membership.Status.ACTIVE
    membership.is_active = True
    membership.save(update_fields=['status', 'is_active', 'updated_at'])

    # Notification au membre
    try:
        from apps.notifications.services import NotificationService
        NotificationService.notify(
            association=membership.association,
            recipient=membership,
            notification_type='membership_activated',
            title="🎉 Vous êtes maintenant membre actif !",
            body=(
                "Vos frais d'adhésion ont été enregistrés. "
                "Vous avez désormais accès à toutes les fonctionnalités."
            ),
            data={'membership_id': str(membership.id)},
        )
    except Exception:
        pass

    return True


# ─── Exonération (waiver) ───────────────────────────────────────────


@db_transaction.atomic
def waive_fee(fee_payment, *, waived_by, reason=''):
    """
    Exonère un membre de ce frais. Pas de flux comptable.
    Doit être appelée uniquement après approbation du workflow Bureau.
    """
    from apps.members.models import MembershipFeePayment

    fp = MembershipFeePayment.all_objects.select_for_update().get(pk=fee_payment.id)
    if fp.status in (MembershipFeePayment.Status.PAID, MembershipFeePayment.Status.WAIVED):
        raise ValueError("Ce frais est déjà soldé/exonéré.")

    fp.status = MembershipFeePayment.Status.WAIVED
    fp.waived_by = waived_by
    fp.waiver_reason = (reason or '').strip()
    fp.completed_at = timezone.now()
    fp.save(update_fields=[
        'status', 'waived_by', 'waiver_reason', 'completed_at', 'updated_at',
    ])

    maybe_activate_membership(fp.membership)
    return fp
