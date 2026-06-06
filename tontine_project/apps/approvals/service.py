"""
Service générique d'approbation : create / approve / reject / cancel /
expire / apply. Tout le flux passe ici, peu importe le `action_type`.
"""
from django.db import transaction as db_transaction
from django.utils import timezone

from apps.approvals.models import BureauApprovalRequest, APPROVAL_TTL
from apps.approvals.registry import get_handler


# ── Détection rôles bureau (factorisé de correction_service) ─────────
def is_president(membership) -> bool:
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
    if not is_bureau_member(membership):
        return False
    if is_president(membership):
        return False
    return True


# ── Notifications ────────────────────────────────────────────────────
def _notify(membership, notif_type, title, body, data=None):
    from apps.notifications.services import NotificationService
    NotificationService.notify(
        association=membership.association,
        recipient=membership,
        notification_type=notif_type,
        title=title, body=body, data=data or {},
    )


def notify_bureau_of_new_request(req):
    from apps.members.models import BureauMember, Membership
    title = "Demande d'approbation Bureau"
    body = req.summary or f"Action : {req.action_type}"
    data = {'approval_request_id': str(req.id), 'type': 'bureau_approval_requested'}

    seen = set()
    bureau = BureauMember.all_objects.filter(
        association=req.association, is_active=True,
    ).select_related('membership').exclude(membership=req.requested_by)
    for bm in bureau:
        if bm.membership_id in seen:
            continue
        seen.add(bm.membership_id)
        _notify(bm.membership, 'bureau_approval_requested', title, body, data)

    if not seen:
        founder = Membership.all_objects.filter(
            association=req.association, is_founder=True,
        ).exclude(id=req.requested_by_id).first()
        if founder:
            _notify(founder, 'bureau_approval_requested', title, body, data)


def notify_requester_of_decision(req, decision_label):
    title = f"Demande {decision_label}"
    body = req.summary or f"Action : {req.action_type}"
    data = {'approval_request_id': str(req.id), 'type': 'bureau_approval_update'}
    _notify(req.requested_by, 'bureau_approval_update', title, body, data)


# ── Helpers ──────────────────────────────────────────────────────────
def is_expired(req) -> bool:
    return timezone.now() >= req.expires_at and req.status not in (
        'approved', 'rejected', 'cancelled', 'expired', 'failed',
    )


def mark_expired(req):
    req.status = 'expired'
    req.save(update_fields=['status', 'updated_at'])


def get_pending_for_target(association, target_model, target_id):
    return BureauApprovalRequest.all_objects.filter(
        association=association,
        target_model=target_model,
        target_id=target_id,
        status__in=['pending', 'pres_approved', 'bureau_approved'],
    ).first()


# ── Flux principal ───────────────────────────────────────────────────
@db_transaction.atomic
def create_request(*, association, action_type, target_id, payload, reason, requested_by):
    """Crée une demande d'approbation. Vérifie cohérence + bloque
    si une autre demande est déjà en cours sur le même target."""
    handler = get_handler(action_type)
    target = handler.get_target_object(target_id, association)
    if target is None:
        raise ValueError(f"Cible introuvable pour {action_type} (id={target_id})")

    existing = get_pending_for_target(
        association, handler.target_model_label, target_id,
    )
    if existing:
        raise ValueError(
            "Une demande d'approbation est déjà en cours sur cette cible."
        )

    handler.validate(association, target, payload, requested_by)
    snap = handler.snapshot(target)
    summary = handler.summary(target, payload)

    req = BureauApprovalRequest.all_objects.create(
        association=association,
        action_type=action_type,
        target_model=handler.target_model_label,
        target_id=target_id,
        requested_by=requested_by,
        payload=payload or {},
        original_snapshot=snap,
        reason=reason,
        summary=summary,
        expires_at=timezone.now() + APPROVAL_TTL,
        requires_triple=bool(getattr(handler, 'requires_triple_approval', False)),
    )
    notify_bureau_of_new_request(req)
    return req


def _all_approvers_distinct(req) -> bool:
    """Vérifie que les approbateurs sont des memberships distincts."""
    ids = [req.president_approval_id, req.bureau_approval_id]
    if req.requires_triple:
        ids.append(req.bureau_approval_2_id)
    filled = [i for i in ids if i is not None]
    return len(set(filled)) == len(filled)


def _required_slots(req) -> int:
    return 3 if req.requires_triple else 2


def _filled_slots(req) -> int:
    n = 0
    if req.president_approval_id: n += 1
    if req.bureau_approval_id: n += 1
    if req.requires_triple and req.bureau_approval_2_id: n += 1
    return n


@db_transaction.atomic
def approve(req, approver):
    """Approuve côté Président OU côté autre membre du bureau.
    Si tous les slots requis sont OK (2 pour normal, 3 pour triple),
    applique automatiquement."""
    if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
        raise ValueError("Cette demande n'est plus en attente.")
    if is_expired(req):
        mark_expired(req)
        raise ValueError("Cette demande a expiré (TTL 24h dépassé).")
    if approver.id == req.requested_by_id:
        raise PermissionError("Vous ne pouvez pas approuver votre propre demande.")

    is_pres = is_president(approver)
    is_other = is_non_president_bureau(approver)

    if is_pres:
        if req.president_approval_id is not None:
            raise ValueError("Déjà approuvé côté Président.")
        if approver.id in (req.bureau_approval_id, req.bureau_approval_2_id):
            raise ValueError("Vous avez déjà approuvé côté Bureau.")
        req.president_approval = approver
        req.president_approval_at = timezone.now()
    elif is_other:
        # Anti-double-approbation par la même personne
        if approver.id == req.president_approval_id:
            raise ValueError("Vous avez déjà approuvé côté Président.")
        if approver.id == req.bureau_approval_id:
            raise ValueError("Vous avez déjà approuvé côté Bureau (slot 1).")
        if req.requires_triple and approver.id == req.bureau_approval_2_id:
            raise ValueError("Vous avez déjà approuvé côté Bureau (slot 2).")

        # Remplir slot bureau 1 sinon slot 2 (si requires_triple)
        if req.bureau_approval_id is None:
            req.bureau_approval = approver
            req.bureau_approval_at = timezone.now()
        elif req.requires_triple and req.bureau_approval_2_id is None:
            req.bureau_approval_2 = approver
            req.bureau_approval_2_at = timezone.now()
        else:
            raise ValueError("Tous les slots Bureau sont déjà remplis.")
    else:
        raise PermissionError("Vous n'avez pas l'autorité pour approuver.")

    # Si tous les slots requis sont remplis → apply
    if _filled_slots(req) >= _required_slots(req):
        if not _all_approvers_distinct(req):
            raise ValueError("Incohérence : approbateurs non distincts.")
        req.save(update_fields=[
            'president_approval', 'president_approval_at',
            'bureau_approval', 'bureau_approval_at',
            'bureau_approval_2', 'bureau_approval_2_at',
            'updated_at',
        ])
        _apply(req, approver)
    else:
        # État intermédiaire : on garde pour l'historique
        req.status = 'pres_approved' if req.president_approval_id else 'bureau_approved'
        req.save(update_fields=[
            'president_approval', 'president_approval_at',
            'bureau_approval', 'bureau_approval_at',
            'bureau_approval_2', 'bureau_approval_2_at',
            'status', 'updated_at',
        ])
    return req


def _apply(req, applied_by):
    """Invoque le handler ; en cas d'erreur, marque la demande comme FAILED."""
    handler = get_handler(req.action_type)
    try:
        side_effects = handler.apply(req, applied_by) or {}
    except Exception as e:  # rollback de la transaction parente
        req.status = 'failed'
        req.apply_error = str(e)[:1000]
        req.save(update_fields=['status', 'apply_error', 'updated_at'])
        notify_requester_of_decision(req, decision_label="échouée")
        raise

    req.side_effects = side_effects
    req.status = 'approved'
    req.applied_at = timezone.now()
    req.save(update_fields=['side_effects', 'status', 'applied_at', 'updated_at'])
    notify_requester_of_decision(req, decision_label="appliquée")


@db_transaction.atomic
def reject(req, approver, rejection_reason):
    if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
        raise ValueError("Cette demande n'est plus en attente.")
    if is_expired(req):
        mark_expired(req)
        raise ValueError("Cette demande a expiré.")
    if approver.id == req.requested_by_id:
        raise PermissionError("Action non autorisée.")
    if not (is_president(approver) or is_non_president_bureau(approver)):
        raise PermissionError("Vous n'avez pas l'autorité pour rejeter.")
    if len((rejection_reason or '').strip()) < 5:
        raise ValueError("Le motif de rejet doit faire au moins 5 caractères.")

    req.status = 'rejected'
    req.rejected_by = approver
    req.rejection_reason = rejection_reason.strip()
    req.save(update_fields=[
        'status', 'rejected_by', 'rejection_reason', 'updated_at',
    ])
    notify_requester_of_decision(req, decision_label="rejetée")
    return req


@db_transaction.atomic
def cancel(req, member):
    if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
        raise ValueError("Cette demande n'est plus annulable.")
    if member.id != req.requested_by_id:
        raise PermissionError("Seul le requérant peut annuler sa demande.")
    req.status = 'cancelled'
    req.save(update_fields=['status', 'updated_at'])
    return req
