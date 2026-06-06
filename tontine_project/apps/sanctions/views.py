from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction as db_transaction

from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.sanctions.models import SanctionType, Sanction
from apps.sanctions.serializers import SanctionTypeSerializer, SanctionSerializer


class SanctionTypeViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = SanctionType.all_objects.all()
    serializer_class = SanctionTypeSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['is_active', 'is_automatic']


class SanctionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Sanction.all_objects.select_related('sanction_type', 'membership__user', 'session')
    serializer_class = SanctionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['membership', 'session', 'status', 'sanction_type']

    # ─── Garde : amount/status verrouillés après création (passer par approval) ──
    PROTECTED_FIELDS = ('amount', 'status')

    def _guard(self, request, sanction):
        from apps.approvals.guards import reject_direct_write
        return reject_direct_write(
            request,
            target_model='sanctions.Sanction',
            target_id=sanction.id,
            action_type='sanction.correction',
            protected_fields=self.PROTECTED_FIELDS,
        )

    def update(self, request, *args, **kwargs):
        sanction = self.get_object()
        guard = self._guard(request, sanction)
        if guard is not None:
            return guard
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        sanction = self.get_object()
        guard = self._guard(request, sanction)
        if guard is not None:
            return guard
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def sign_receipt(self, request, pk=None):
        """Signe le bordereau d'une sanction payée."""
        sanction = self.get_object()
        if sanction.receipt_pdf:
            return Response(
                {'error': "Cette sanction a déjà un bordereau signé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if sanction.status != 'paid':
            return Response(
                {'error': "Seules les sanctions payées peuvent être signées."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sig = request.data.get('signature')
        if not sig or not sig.startswith('data:image/'):
            return Response(
                {'error': 'Signature manquante ou invalide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device_info = dict(request.data.get('device_info') or {})
        device_info.setdefault('ip', (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR', '')
        ))
        device_info.setdefault('user_agent', request.META.get('HTTP_USER_AGENT', ''))

        from apps.finance.receipt_service import sign_sanction_receipt
        base_url = request.build_absolute_uri('/').rstrip('/')
        try:
            sign_sanction_receipt(sanction, sig, device_info, base_url)
        except Exception as e:
            return Response(
                {'error': f"Échec génération : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(SanctionSerializer(sanction).data)
