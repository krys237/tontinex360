from rest_framework import viewsets, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db import IntegrityError, transaction
from django.utils import timezone
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.members.models import (
    Membership, Role, MemberRole, BureauPosition, BureauMember,
    MembershipRequest, Resignation,
)
from apps.members.serializers import (
    MembershipSerializer, MembershipListSerializer,
    RoleSerializer, BureauPositionSerializer, BureauMemberSerializer,
    MembershipRequestCreateSerializer, MembershipRequestSerializer,
    MembershipRequestReviewSerializer,
    ResignationCreateSerializer, ResignationSerializer,
    ResignationReviewSerializer,
)


def _resolve_current_cycle(association):
    """
    Cycle courant pour les frais 'per_cycle' : le cycle actif (status='active')
    le plus récent, sinon le brouillon le plus récent.
    """
    from apps.cycles.models import Cycle
    cycle = Cycle.all_objects.filter(
        association=association, status=Cycle.Status.ACTIVE,
    ).order_by('-start_date').first()
    if cycle is None:
        cycle = Cycle.all_objects.filter(
            association=association, status=Cycle.Status.DRAFT,
        ).order_by('-start_date').first()
    return cycle


def _user_has_bureau_authority(user, association, required_perm=None):
    """Vrai si l'utilisateur a un rôle de bureau ou la permission demandée."""
    try:
        membership = Membership.all_objects.get(
            user=user, association=association, is_active=True,
        )
    except Membership.DoesNotExist:
        return None

    roles = MemberRole.all_objects.filter(
        membership=membership, is_active=True,
    ).select_related('role')

    for member_role in roles:
        role = member_role.role
        if role.is_bureau_role:
            return membership
        perms = role.permissions or []
        if '*' in perms or 'members.*' in perms:
            return membership
        if required_perm and required_perm in perms:
            return membership
    return None


class MembershipViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Membership.all_objects.select_related('user').prefetch_related('roles__role')
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get_serializer_class(self):
        if self.action == 'list':
            return MembershipListSerializer
        return MembershipSerializer

    @action(detail=True, methods=['post'], url_path='signature')
    @transaction.atomic
    def set_signature(self, request, pk=None):
        """
        Enregistre la signature de référence du membre.

        Le membre peut signer sa propre fiche, ou un membre du bureau
        peut signer pour lui (cas où le membre est sur place mais sans device).

        Payload : { "signature": "data:image/png;base64,..." }
        """
        membership = self.get_object()

        is_self = membership.user_id == request.user.id
        reviewer = _user_has_bureau_authority(
            request.user, request.association,
            required_perm='members.update',
        )
        if not is_self and reviewer is None:
            raise PermissionDenied(
                "Seul le membre lui-même ou un responsable du bureau "
                "peut enregistrer la signature.",
            )

        signature = request.data.get('signature', '')
        if not signature or not signature.startswith('data:image/'):
            return Response(
                {'error': "Signature manquante ou invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import base64
        from django.core.files.base import ContentFile
        try:
            _, b64 = signature.split(',', 1)
            sig_bytes = base64.b64decode(b64)
        except Exception:
            return Response(
                {'error': "Signature illisible."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership.signature_reference.save(
            f"sig_{membership.id}.png",
            ContentFile(sig_bytes), save=False,
        )
        membership.signature_reference_at = timezone.now()
        membership.save(update_fields=['signature_reference', 'signature_reference_at'])

        return Response(
            MembershipSerializer(membership).data,
            status=status.HTTP_200_OK,
        )


class RoleViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Role.all_objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise drf_serializers.ValidationError({
                'slug': [
                    f"Un rôle avec le slug '{serializer.validated_data.get('slug')}' "
                    "existe déjà dans cette association."
                ],
            })

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise drf_serializers.ValidationError({
                'slug': [
                    f"Un rôle avec le slug '{serializer.validated_data.get('slug')}' "
                    "existe déjà dans cette association."
                ],
            })

    def perform_destroy(self, instance):
        if instance.is_system:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Les rôles système ne peuvent pas être supprimés.")
        instance.delete()


class BureauPositionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = BureauPosition.all_objects.all()
    serializer_class = BureauPositionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]


class BureauMemberViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = BureauMember.all_objects.select_related('membership__user', 'position')
    serializer_class = BureauMemberSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]


class MembershipRequestViewSet(viewsets.ModelViewSet):
    """
    Demandes d'adhésion à une association pour un nouveau cycle.

    - create : tout utilisateur authentifié (pas besoin d'être déjà membre).
    - list / retrieve : membre actif de l'association.
    - approve / reject : membre du bureau (ou permission `members.approve_request`).
    """
    queryset = MembershipRequest.all_objects.select_related(
        'user', 'reviewed_by__user', 'cycle',
    )
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), HasAssociation()]
        if self.action in ('cancel',):
            return [IsAuthenticated(), HasAssociation()]
        return [IsAuthenticated(), HasAssociation(), IsMember()]

    def get_serializer_class(self):
        if self.action == 'create':
            return MembershipRequestCreateSerializer
        if self.action in ('approve', 'reject'):
            return MembershipRequestReviewSerializer
        return MembershipRequestSerializer

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return self.queryset.none()
        qs = self.queryset.filter(association=association)
        if self.action == 'list':
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            association=self.request.association,
            user=self.request.user,
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            MembershipRequestSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        membership_request = self.get_object()

        if membership_request.status != MembershipRequest.Status.PENDING:
            raise drf_serializers.ValidationError(
                "Cette demande a déjà été traitée."
            )

        reviewer = _user_has_bureau_authority(
            request.user, request.association,
            required_perm='members.approve_request',
        )
        if reviewer is None:
            raise PermissionDenied(
                "Seuls les membres du bureau peuvent approuver une demande."
            )

        serializer = MembershipRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Déterminer le statut initial : si l'asso impose l'inscription comme
        # porte d'entrée → 'pending' jusqu'au paiement ; sinon 'active'.
        from apps.members import fees_service
        fees_cfg = fees_service.get_config(membership_request.association)
        entry_gate = (
            fees_cfg['registration'].get('enabled')
            and fees_cfg['registration'].get('is_entry_gate')
            and float(fees_cfg['registration'].get('amount', 0)) > 0
        )
        initial_status = (
            Membership.Status.PENDING if entry_gate else Membership.Status.ACTIVE
        )
        initial_active = not entry_gate

        existing = Membership.all_objects.filter(
            association=membership_request.association,
            user=membership_request.user,
        ).first()

        if existing:
            # Si on réactive un ancien membre : on respecte aussi l'entry_gate
            existing.status = initial_status
            existing.is_active = initial_active
            existing.save()
            new_membership = existing
        else:
            new_membership = Membership.all_objects.create(
                association=membership_request.association,
                user=membership_request.user,
                status=initial_status,
                is_active=initial_active,
            )

        # Créer les FeePayment requis (inscription + fond) si configurés
        try:
            current_cycle = _resolve_current_cycle(membership_request.association)
            fees_service.create_initial_fees(
                new_membership, current_cycle=current_cycle, mark_as_paid=False,
            )
        except Exception:
            # Ne pas faire échouer l'approbation si fees échouent (best-effort)
            pass

        membership_request.status = MembershipRequest.Status.APPROVED
        membership_request.reviewed_by = reviewer
        membership_request.review_note = serializer.validated_data.get('review_note', '')
        membership_request.reviewed_at = timezone.now()
        membership_request.resulting_membership = new_membership
        membership_request.save()

        return Response(
            MembershipRequestSerializer(membership_request).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        membership_request = self.get_object()

        if membership_request.status != MembershipRequest.Status.PENDING:
            raise drf_serializers.ValidationError(
                "Cette demande a déjà été traitée."
            )

        reviewer = _user_has_bureau_authority(
            request.user, request.association,
            required_perm='members.approve_request',
        )
        if reviewer is None:
            raise PermissionDenied(
                "Seuls les membres du bureau peuvent rejeter une demande."
            )

        serializer = MembershipRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership_request.status = MembershipRequest.Status.REJECTED
        membership_request.reviewed_by = reviewer
        membership_request.review_note = serializer.validated_data.get('review_note', '')
        membership_request.reviewed_at = timezone.now()
        membership_request.save()

        return Response(
            MembershipRequestSerializer(membership_request).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """L'utilisateur annule sa propre demande tant qu'elle est en attente."""
        membership_request = self.get_object()

        if membership_request.user_id != request.user.id:
            raise PermissionDenied("Vous ne pouvez annuler que vos propres demandes.")
        if membership_request.status != MembershipRequest.Status.PENDING:
            raise drf_serializers.ValidationError("Cette demande a déjà été traitée.")

        membership_request.status = MembershipRequest.Status.CANCELLED
        membership_request.save()

        return Response(
            MembershipRequestSerializer(membership_request).data,
            status=status.HTTP_200_OK,
        )


class ResignationViewSet(viewsets.ModelViewSet):
    """
    Demandes de démission soumises par les membres.

    - create : membre actif soumet sa propre démission (motif obligatoire).
    - list / retrieve : un membre voit ses propres démissions ; un membre du
      bureau voit toutes les démissions de l'association.
    - approve / reject : membre du bureau uniquement.
    - cancel : le demandeur annule sa propre démission tant qu'elle est en attente.
    """
    queryset = Resignation.all_objects.select_related(
        'membership__user', 'reviewed_by__user',
    )
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get_serializer_class(self):
        if self.action == 'create':
            return ResignationCreateSerializer
        if self.action in ('approve', 'reject'):
            return ResignationReviewSerializer
        return ResignationSerializer

    def _current_membership(self):
        return Membership.all_objects.filter(
            association=self.request.association,
            user=self.request.user,
            is_active=True,
        ).first()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['membership'] = self._current_membership()
        return context

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return self.queryset.none()

        qs = self.queryset.filter(association=association)

        membership = self._current_membership()
        if not membership:
            return qs.none()

        if _user_has_bureau_authority(
            self.request.user, association,
            required_perm='members.approve_resignation',
        ):
            return qs

        return qs.filter(membership=membership)

    def create(self, request, *args, **kwargs):
        membership = self._current_membership()
        if not membership:
            raise PermissionDenied("Vous devez être membre actif.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            association=request.association,
            membership=membership,
        )
        return Response(
            ResignationSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        resignation = self.get_object()

        if resignation.status != Resignation.Status.PENDING:
            raise drf_serializers.ValidationError("Cette démission a déjà été traitée.")

        reviewer = _user_has_bureau_authority(
            request.user, request.association,
            required_perm='members.approve_resignation',
        )
        if reviewer is None:
            raise PermissionDenied(
                "Seuls les membres du bureau peuvent approuver une démission."
            )

        serializer = ResignationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        effective = serializer.validated_data.get('effective_date') \
            or resignation.effective_date \
            or timezone.now().date()

        membership = resignation.membership
        membership.status = Membership.Status.RESIGNED
        membership.is_active = False
        membership.save()

        MemberRole.all_objects.filter(
            membership=membership, is_active=True,
        ).update(is_active=False)

        BureauMember.all_objects.filter(
            membership=membership, is_active=True,
        ).update(is_active=False, end_date=effective)

        resignation.status = Resignation.Status.APPROVED
        resignation.reviewed_by = reviewer
        resignation.review_note = serializer.validated_data.get('review_note', '')
        resignation.reviewed_at = timezone.now()
        resignation.effective_date = effective
        resignation.save()

        return Response(
            ResignationSerializer(resignation).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        resignation = self.get_object()

        if resignation.status != Resignation.Status.PENDING:
            raise drf_serializers.ValidationError("Cette démission a déjà été traitée.")

        reviewer = _user_has_bureau_authority(
            request.user, request.association,
            required_perm='members.approve_resignation',
        )
        if reviewer is None:
            raise PermissionDenied(
                "Seuls les membres du bureau peuvent rejeter une démission."
            )

        serializer = ResignationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resignation.status = Resignation.Status.REJECTED
        resignation.reviewed_by = reviewer
        resignation.review_note = serializer.validated_data.get('review_note', '')
        resignation.reviewed_at = timezone.now()
        resignation.save()

        return Response(
            ResignationSerializer(resignation).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """Le demandeur annule sa propre démission tant qu'elle est en attente."""
        resignation = self.get_object()
        membership = self._current_membership()

        if not membership or resignation.membership_id != membership.id:
            raise PermissionDenied("Vous ne pouvez annuler que vos propres démissions.")
        if resignation.status != Resignation.Status.PENDING:
            raise drf_serializers.ValidationError("Cette démission a déjà été traitée.")

        resignation.status = Resignation.Status.CANCELLED
        resignation.save()

        return Response(
            ResignationSerializer(resignation).data,
            status=status.HTTP_200_OK,
        )
