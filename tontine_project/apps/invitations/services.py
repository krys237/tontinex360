from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from common.exceptions import LimitExceededError
from apps.core.utils import send_message


def _maybe_attach_bureau_position(*, membership, role, invited_by):
    """
    Si une `BureauPosition` correspond au rôle (même slug ou même nom),
    crée le `BureauMember` actif lié — pour qu'un membre invité avec
    le rôle « Trésorier » apparaisse directement dans la liste du bureau.

    Idempotent : si un mandat actif existe déjà pour ce membre sur cette
    position, on ne fait rien. Échoue silencieusement en cas de problème
    (le membre garde son rôle, juste pas de mandat bureau auto).
    """
    try:
        from apps.members.models import BureauPosition, BureauMember
        position = (
            BureauPosition.all_objects.filter(
                association=membership.association, slug=role.slug,
            ).first()
            or BureauPosition.all_objects.filter(
                association=membership.association, name__iexact=role.name,
            ).first()
        )
        if not position:
            return None

        existing = BureauMember.all_objects.filter(
            membership=membership, position=position, is_active=True,
        ).first()
        if existing:
            return existing

        return BureauMember.objects.create(
            association=membership.association,
            membership=membership,
            position=position,
            start_date=timezone.now().date(),
            is_active=True,
            designation_method='invitation_role',
        )
    except Exception:
        return None


def _resolve_current_cycle(association):
    """Cycle actif courant pour les frais 'per_cycle'."""
    from apps.cycles.models import Cycle
    cycle = Cycle.all_objects.filter(
        association=association, status=Cycle.Status.ACTIVE,
    ).order_by('-start_date').first()
    if cycle is None:
        cycle = Cycle.all_objects.filter(
            association=association, status=Cycle.Status.DRAFT,
        ).order_by('-start_date').first()
    return cycle


class InvitationService:
    DEFAULT_EXPIRY_DAYS = 7

    @classmethod
    def send_invitation(cls, invited_by, email=None, phone=None, name='',
                        role=None, channel='link', message='',
                        auto_mark_fees_paid=False):
        from apps.invitations.models import Invitation

        association = invited_by.association
        cls._check_invite_permission(invited_by)
        cls._check_member_limit(association)
        cls._check_duplicate(association, email, phone)

        if not email and not phone:
            raise ValueError("Email ou telephone requis.")

        invitation = Invitation.objects.create(
            association=association, invited_by=invited_by,
            email=email or '', phone=phone or '', name=name,
            role=role, channel=channel, message=message,
            expires_at=timezone.now() + timedelta(days=cls.DEFAULT_EXPIRY_DAYS),
            auto_mark_fees_paid=bool(auto_mark_fees_paid),
        )
        cls._dispatch(invitation)
        return invitation

    @classmethod
    @transaction.atomic
    def accept_invitation(cls, token, user):
        from apps.invitations.models import Invitation
        from apps.members.models import Membership, MemberRole, Role

        invitation = Invitation.all_objects.get(token=token)
        
        if not invitation.is_valid:
            raise ValueError("Invitation expiree ou invalide.")

        if Membership.all_objects.filter(
            association=invitation.association, user=user, is_active=True
        ).exists():
            raise ValueError("Vous etes deja membre.")

        # Si l'asso impose l'inscription comme porte d'entrée ET que les
        # fees ne sont PAS marqués comme déjà payés, le membre démarre en
        # 'pending' (basculera 'active' au paiement de l'inscription).
        from apps.members import fees_service
        fees_cfg = fees_service.get_config(invitation.association)
        entry_gate = (
            fees_cfg['registration'].get('enabled')
            and fees_cfg['registration'].get('is_entry_gate')
            and float(fees_cfg['registration'].get('amount', 0)) > 0
        )
        should_pend = entry_gate and not invitation.auto_mark_fees_paid
        initial_status = (
            Membership.Status.PENDING if should_pend else Membership.Status.ACTIVE
        )
        initial_active = not should_pend

        membership = Membership.objects.create(
            association=invitation.association, user=user,
            status=initial_status,
            is_active=initial_active,
        )

        role = invitation.role or Role.all_objects.filter(
            association=invitation.association, slug='membre', is_system=True
        ).first()

        if role:
            MemberRole.objects.create(
                association=invitation.association, membership=membership,
                role=role, assigned_by=invitation.invited_by, is_active=True,
            )

            # Si le rôle est un rôle bureau (président, trésorier, secrétaire…)
            # ET qu'une BureauPosition de même slug existe, on crée
            # automatiquement le BureauMember correspondant pour que le membre
            # apparaisse tout de suite dans /bureau-members/ sans étape manuelle.
            if getattr(role, 'is_bureau_role', False):
                _maybe_attach_bureau_position(
                    membership=membership,
                    role=role,
                    invited_by=invitation.invited_by,
                )

        # Créer les FeePayment : si auto_mark_fees_paid → tous en 'paid'
        try:
            current_cycle = _resolve_current_cycle(invitation.association)
            fees_service.create_initial_fees(
                membership, current_cycle=current_cycle,
                mark_as_paid=bool(invitation.auto_mark_fees_paid),
            )
        except Exception:
            pass

        invitation.status = Invitation.Status.ACCEPTED
        invitation.accepted_at = timezone.now()
        invitation.resulting_membership = membership
        invitation.save()

        return invitation, membership

    @staticmethod
    def _check_invite_permission(membership):
        from apps.members.models import MemberRole
        roles = MemberRole.all_objects.filter(membership=membership, is_active=True).select_related('role')
        for mr in roles:
            perms = mr.role.permissions
            if '*' in perms or 'members.invite' in perms or 'members.*' in perms:
                return True
        raise PermissionError("Permission d\'inviter requise.")

    @staticmethod
    def _check_member_limit(association):
        sub = getattr(association, 'subscription', None)
        if sub and not sub.check_member_limit():
            raise LimitExceededError(f"Limite de {sub.plan.max_members} membres atteinte.")

    @staticmethod
    def _check_duplicate(association, email, phone):
        from apps.invitations.models import Invitation
        from django.db.models import Q
        filters = Q(association=association, status=Invitation.Status.PENDING)
        if email:
            filters &= Q(email=email)
        elif phone:
            filters &= Q(phone=phone)
        else:
            return
        if Invitation.all_objects.filter(filters).exists():
            raise ValueError("Invitation deja en cours pour cette personne.")

    @staticmethod
    def _dispatch(invitation):
        telephone = invitation.phone
        email = invitation.email
        if telephone:
            send_message(telephone,invitation.message)
            # implement sms with twilio after 
        if email:
            # config email with Gmail or another
            pass 
