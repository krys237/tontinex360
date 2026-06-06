from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.decorators import action

from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.wallets.models import Wallet, WalletEntry
from apps.wallets.serializers import (
    WalletSerializer, WalletEntrySerializer,
    ManualAdjustmentSerializer,
)
from apps.wallets.services import WalletService


def _bureau_membership(request, required_perm=None):
    """Retourne le Membership si l'utilisateur a une autorité bureau, sinon None."""
    from apps.members.views import _user_has_bureau_authority
    return _user_has_bureau_authority(
        request.user, request.association, required_perm=required_perm,
    )


def _current_membership(request):
    from apps.members.models import Membership
    return Membership.all_objects.filter(
        association=request.association, user=request.user, is_active=True,
    ).first()


# =============================================================================
# Mon wallet (membre)
# =============================================================================

class MyWalletView(APIView):
    """Wallet du membre courant."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        membership = _current_membership(request)
        if not membership:
            raise PermissionDenied("Vous n'êtes pas membre de cette association.")
        wallet = WalletService.ensure_wallet(membership)
        return Response(WalletSerializer(wallet).data)


class MyWalletEntriesView(APIView):
    """Historique des écritures du membre courant."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        membership = _current_membership(request)
        if not membership:
            raise PermissionDenied("Vous n'êtes pas membre de cette association.")
        wallet = WalletService.ensure_wallet(membership)

        qs = WalletEntry.all_objects.filter(wallet=wallet)
        session_id = request.query_params.get('session')
        cycle_id = request.query_params.get('cycle')
        source_type = request.query_params.get('source_type')
        if session_id:
            qs = qs.filter(session_id=session_id)
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        if source_type:
            qs = qs.filter(source_type=source_type)

        return Response(WalletEntrySerializer(qs, many=True).data)


class MyWalletSummaryView(APIView):
    """Récap du wallet par cycle (totaux par source)."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        from django.db import models as dj_models

        membership = _current_membership(request)
        if not membership:
            raise PermissionDenied("Vous n'êtes pas membre.")
        wallet = WalletService.ensure_wallet(membership)

        cycle_id = request.query_params.get('cycle')
        qs = WalletEntry.all_objects.filter(wallet=wallet)
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)

        agg = qs.values('source_type', 'direction').annotate(
            total=dj_models.Sum('amount'),
        ).order_by('source_type')

        credits = sum((row['total'] for row in agg if row['direction'] == 'credit'), Decimal('0'))
        debits = sum((row['total'] for row in agg if row['direction'] == 'debit'), Decimal('0'))

        return Response({
            'wallet': WalletSerializer(wallet).data,
            'cycle': cycle_id,
            'credits_total': credits,
            'debits_total': debits,
            'net': credits - debits,
            'breakdown': list(agg),
        })


# =============================================================================
# Vue bureau — tous les wallets de l'association
# =============================================================================

class WalletViewSet(viewsets.ReadOnlyModelViewSet):
    """Vue bureau de tous les wallets de l'association."""
    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return Wallet.all_objects.none()
        if not _bureau_membership(self.request, required_perm='wallets.view_all'):
            return Wallet.all_objects.none()
        return Wallet.all_objects.filter(
            association=association,
        ).select_related('membership__user')

    @action(detail=True, methods=['get'])
    def entries(self, request, pk=None):
        wallet = self.get_object()
        qs = WalletEntry.all_objects.filter(wallet=wallet)
        return Response(WalletEntrySerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def recompute(self, request, pk=None):
        if not _bureau_membership(request, required_perm='wallets.recompute'):
            raise PermissionDenied("Réservé au bureau.")
        wallet = self.get_object()
        WalletService.recompute_balance(wallet)
        return Response(WalletSerializer(wallet).data)


# =============================================================================
# Actions bureau
# =============================================================================

class ManualAdjustmentView(APIView):
    """
    Ajustement manuel sur un wallet par le bureau.

    Depuis l'introduction du framework d'approbations (Phase B), cette opération
    nécessite une **double validation Président + Bureau**. Cet endpoint
    soumet désormais une demande au lieu d'appliquer immédiatement.
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request):
        reviewer = _bureau_membership(request, required_perm='wallets.manual_adjustment')
        if reviewer is None:
            raise PermissionDenied("Réservé au bureau.")

        s = ManualAdjustmentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data

        from apps.members.models import Membership
        try:
            membership = Membership.all_objects.get(
                id=d['membership_id'], association=request.association,
            )
        except Membership.DoesNotExist:
            raise NotFound("Membre introuvable.")

        wallet, _ = Wallet.all_objects.get_or_create(
            membership=membership,
            defaults={'association_id': request.association.id},
        )

        from apps.approvals import service as approval_service
        try:
            req = approval_service.create_request(
                association=request.association,
                action_type='wallet.manual_adjustment',
                target_id=wallet.id,
                payload={
                    'direction': d['direction'],
                    'amount': str(d['amount']),
                    'description': d['description'],
                },
                reason=d.get('description') or 'Ajustement manuel',
                requested_by=reviewer,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        from apps.approvals.serializers import BureauApprovalRequestSerializer
        return Response(
            {
                'approval_request': BureauApprovalRequestSerializer(req).data,
                'message': (
                    "Demande d'ajustement soumise. Validation requise par le "
                    "Président + un autre membre du bureau."
                ),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class CycleSettlementView(APIView):
    """Récapitulatif fin de cycle — réservé au bureau."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        if not _bureau_membership(request, required_perm='wallets.cycle_settlement'):
            raise PermissionDenied("Réservé au bureau.")
        cycle_id = request.query_params.get('cycle')
        if not cycle_id:
            return Response({'error': "Paramètre 'cycle' requis."}, status=400)

        from apps.cycles.models import Cycle
        cycle = Cycle.all_objects.filter(
            id=cycle_id, association=request.association,
        ).first()
        if not cycle:
            raise NotFound("Cycle introuvable.")

        data = WalletService.cycle_settlement(request.association, cycle)
        return Response({
            'cycle_id': str(cycle.id),
            'cycle_name': cycle.name,
            'rows': data,
            'totals': {
                'credits': sum((r['credits'] for r in data), Decimal('0')),
                'debits': sum((r['debits'] for r in data), Decimal('0')),
                'net': sum((r['net'] for r in data), Decimal('0')),
            },
        })
