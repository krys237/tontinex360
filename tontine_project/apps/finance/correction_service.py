"""
Service de correction de cotisations avec double validation.

Workflow:
- La trésorière crée une demande (request-correction)
- Le Président et un autre membre du bureau doivent approuver
- À la 2ᵉ approbation, le correctif est appliqué atomiquement
- Notifications FCM + in-app à chaque étape
- TTL de 24h : au-delà, plus aucune action possible (expire)
"""
from datetime import timedelta
from decimal import Decimal
from django.db import transaction as db_transaction
from django.utils import timezone


CORRECTION_TTL = timedelta(hours=24)


def _recalculate_status(contribution, new_paid_amount):
    """Reproduit la logique de bascule de statut côté backend."""
    if new_paid_amount <= 0:
        return 'pending'
    if new_paid_amount >= contribution.expected_amount:
        return 'paid'
    return 'partial'


def is_president(membership) -> bool:
    """Le Président est :
    - un membre actif du bureau avec position slug='president', OU
    - le fondateur (`is_founder=True`) si pas encore de bureau formel.
    """
    if not membership:
        return False
    if getattr(membership, 'is_founder', False):
        return True
    from apps.members.models import BureauMember
    return BureauMember.all_objects.filter(
        association=membership.association,
        membership=membership,
        is_active=True,
        position__slug='president',
    ).exists()


def is_bureau_member(membership) -> bool:
    """Tout membre actif d'un bureau ou le fondateur."""
    if not membership:
        return False
    if getattr(membership, 'is_founder', False):
        return True
    from apps.members.models import BureauMember
    return BureauMember.all_objects.filter(
        association=membership.association,
        membership=membership,
        is_active=True,
    ).exists()


def is_non_president_bureau(membership) -> bool:
    """Bureau actif mais ≠ président (pour la 2ᵉ approbation)."""
    if not is_bureau_member(membership):
        return False
    if is_president(membership):
        # Sauf cas dégénéré : si la personne est président ET fondateur, on autorise
        # uniquement le slot président.
        return False
    return True


def _notify(membership, notif_type, title, body, data=None):
    """Crée une notification in-app et déclenche FCM."""
    from apps.notifications.services import NotificationService
    NotificationService.notify(
        association=membership.association,
        recipient=membership,
        notification_type=notif_type,
        title=title, body=body, data=data or {},
    )
    _send_fcm(membership.user, title, body)


def _send_fcm(user, title, body):
    """Envoi push FCM best-effort, sans casser le flux si échec."""
    try:
        from apps.core.utils import notify_user
        notify_user(user, title, body)
    except Exception:
        pass


def notify_bureau_of_new_request(req):
    """Notifie le Président et les autres membres du bureau qu'une demande arrive."""
    from apps.members.models import BureauMember

    title = "Demande de correction de cotisation"
    body = (
        f"{req.requested_by.user.first_name} {req.requested_by.user.last_name} "
        f"demande la correction d'une cotisation : "
        f"{req.original_paid_amount} → {req.new_paid_amount} XAF. Motif : {req.reason[:80]}"
    )
    data = {'request_id': str(req.id), 'type': 'contribution_correction'}

    bureau = BureauMember.all_objects.filter(
        association=req.association, is_active=True,
    ).select_related('membership').exclude(membership=req.requested_by)
    seen = set()
    for bm in bureau:
        if bm.membership_id in seen:
            continue
        seen.add(bm.membership_id)
        _notify(bm.membership, 'contribution_correction_requested', title, body, data)

    # Si pas de bureau formel : notifier le fondateur s'il n'est pas requérant
    if not seen:
        from apps.members.models import Membership
        founder = Membership.all_objects.filter(
            association=req.association, is_founder=True,
        ).exclude(id=req.requested_by_id).first()
        if founder:
            _notify(founder, 'contribution_correction_requested', title, body, data)


def notify_requester_of_decision(req, decision_label):
    """Notifie le requérant + le membre concerné par la cotisation."""
    title = f"Correction {decision_label}"
    body = (
        f"La demande de correction de la cotisation de "
        f"{req.contribution.membership.user.first_name} a été {decision_label}."
    )
    data = {'request_id': str(req.id), 'type': 'contribution_correction_update'}

    _notify(req.requested_by, 'contribution_correction_update', title, body, data)
    # Le membre concerné (titulaire de la cotisation) est aussi informé
    if req.contribution.membership_id != req.requested_by_id:
        _notify(req.contribution.membership, 'contribution_correction_update', title, body, data)


def is_expired(req) -> bool:
    return timezone.now() >= req.expires_at and req.status not in (
        'approved', 'rejected', 'cancelled', 'expired',
    )


def mark_expired(req):
    req.status = 'expired'
    req.save(update_fields=['status', 'updated_at'])


@db_transaction.atomic
def apply_correction(req, *, applied_by):
    """
    Applique le correctif sur la cotisation :
    - reverse l'éventuelle transaction comptable précédente (type=contribution)
    - crée une nouvelle transaction avec le bon montant
    - met à jour la contribution (paid_amount, paid_at, status)
    Tout en une seule transaction DB.
    """
    from apps.finance.models import Contribution, Transaction
    from apps.finance.services import TontineFundService, ContributionPaymentService

    contribution = Contribution.all_objects.select_for_update().get(pk=req.contribution_id)
    if contribution.receipt_pdf:
        raise ValueError("Bordereau déjà signé — utilisez la procédure d'annulation.")

    # 1. Reverser la transaction comptable existante (lookup par référence
    # canonique = pas d'ambiguïté avec d'éventuels ajustements antérieurs)
    prev_tx = ContributionPaymentService.existing_transaction(contribution)

    reversal = None
    if prev_tx is not None:
        reversal = TontineFundService.create_transaction(
            association=req.association,
            account=prev_tx.account,
            tontine_type=prev_tx.tontine_type,
            transaction_type=Transaction.TransactionType.ADJUSTMENT,
            amount=prev_tx.amount,
            is_debit=not prev_tx.is_debit,  # inverse du sens
            description=f"Annulation cotisation #{contribution.id} suite correction.",
            session=contribution.session,
            membership=contribution.membership,
            recorded_by=applied_by,
            reference=f"reverse:{prev_tx.id}",
            allow_overdraft=True,
        )
        # On retire la référence canonique de l'ancienne transaction pour
        # qu'elle ne soit plus considérée comme l'unique transaction de
        # paiement de cette cotisation.
        prev_tx.reference = f"superseded:{prev_tx.id}"
        prev_tx.save(update_fields=['reference', 'updated_at'])

    # 2. Nouvelle transaction au montant corrigé (si > 0), portant la
    # référence canonique pour que toute correction future la retrouve.
    new_tx = None
    new_amount = Decimal(req.new_paid_amount)
    if new_amount > 0:
        # Utilise le compte de l'ancienne TX si elle existe, sinon résout
        # via le service de paiement (fallback caisse cash).
        account = prev_tx.account if prev_tx else ContributionPaymentService._resolve_account(contribution)
        if account is None:
            raise ValueError("Aucune caisse active pour comptabiliser la correction.")
        new_tx = TontineFundService.create_transaction(
            association=req.association,
            account=account,
            tontine_type=contribution.tontine_type,
            transaction_type=Transaction.TransactionType.CONTRIBUTION,
            amount=new_amount,
            is_debit=False,
            description=f"Cotisation corrigée #{contribution.id} (was {req.original_paid_amount}).",
            session=contribution.session,
            membership=contribution.membership,
            recorded_by=applied_by,
            reference=ContributionPaymentService.reference_for(contribution),
            allow_overdraft=True,
        )

    # 3. Mettre à jour la cotisation
    new_status = _recalculate_status(contribution, new_amount)
    contribution.paid_amount = new_amount
    contribution.status = new_status
    if new_amount > 0 and not contribution.paid_at:
        contribution.paid_at = timezone.now()
    elif new_amount == 0:
        contribution.paid_at = None
    contribution.save(update_fields=['paid_amount', 'status', 'paid_at', 'updated_at'])

    # 4. Marquer la demande comme appliquée
    req.new_status = new_status
    req.status = 'approved'
    req.applied_at = timezone.now()
    req.reversal_transaction = reversal
    req.new_transaction = new_tx
    req.save(update_fields=[
        'new_status', 'status', 'applied_at',
        'reversal_transaction', 'new_transaction', 'updated_at',
    ])

    notify_requester_of_decision(req, decision_label="appliquée")
    return req
