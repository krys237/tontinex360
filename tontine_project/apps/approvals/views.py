from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action

from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember

from apps.approvals.models import BureauApprovalRequest
from apps.approvals.serializers import BureauApprovalRequestSerializer
from apps.approvals import service as approval_service
from apps.approvals.registry import list_handlers


class BureauApprovalRequestViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    """
    Liste les demandes d'approbation + actions request/approve/reject/cancel.
    Création via POST /request/ (le body porte action_type + target_id + payload + reason).
    """
    queryset = BureauApprovalRequest.all_objects.select_related(
        'requested_by__user',
        'president_approval__user',
        'bureau_approval__user',
        'rejected_by__user',
    )
    serializer_class = BureauApprovalRequestSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['status', 'action_type', 'target_model']

    def _membership(self, request):
        return getattr(request, 'current_membership', None) or request.user.memberships.filter(
            association=request.association,
        ).first()

    # ── Création générique ──────────────────────────────────────────
    @action(detail=False, methods=['post'])
    def request(self, request):
        action_type = request.data.get('action_type')
        target_id = request.data.get('target_id')
        payload = request.data.get('payload') or {}
        reason = (request.data.get('reason') or '').strip()
        if not action_type or not target_id:
            return Response(
                {'error': "action_type et target_id sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(reason) < 5:
            return Response(
                {'error': "Le motif doit faire au moins 5 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        member = self._membership(request)
        if not member:
            return Response({'error': "Membership introuvable."}, status=403)
        try:
            req = approval_service.create_request(
                association=request.association,
                action_type=action_type,
                target_id=target_id,
                payload=payload,
                reason=reason,
                requested_by=member,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            BureauApprovalRequestSerializer(req).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        member = self._membership(request)
        if not member:
            return Response({'error': "Membership introuvable."}, status=403)
        try:
            approval_service.approve(req, member)
        except PermissionError as e:
            return Response({'error': str(e)}, status=403)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        req.refresh_from_db()
        return Response(BureauApprovalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        member = self._membership(request)
        if not member:
            return Response({'error': "Membership introuvable."}, status=403)
        try:
            approval_service.reject(
                req, member, request.data.get('rejection_reason', ''),
            )
        except PermissionError as e:
            return Response({'error': str(e)}, status=403)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        return Response(BureauApprovalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        req = self.get_object()
        member = self._membership(request)
        if not member:
            return Response({'error': "Membership introuvable."}, status=403)
        try:
            approval_service.cancel(req, member)
        except PermissionError as e:
            return Response({'error': str(e)}, status=403)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        return Response(BureauApprovalRequestSerializer(req).data)

    @action(detail=False, methods=['get'])
    def handlers(self, request):
        """Liste les action_type disponibles (pour le frontend)."""
        return Response([
            {
                'action_type': at,
                'target_model': cls.target_model_label,
                'human_label': cls.human_label,
            }
            for at, cls in list_handlers().items()
        ])
