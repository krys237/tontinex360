"""
Endpoints pour la gestion des frais d'adhésion (Phase A).

Routes :
- GET   /members/fees/config/           : lit la config de l'association
- PATCH /members/fees/config/           : modifie la config
- GET   /members/fees/                  : liste des FeePayment (avec filtres)
- GET   /members/fees/{id}/             : détail d'un FeePayment
- POST  /members/fees/{id}/record/      : enregistre un versement
- GET   /members/fees/by-membership/{membership_id}/ : statut frais d'un membre
- GET   /members/fees/pending-overview/ : vue d'ensemble pour le trésorier
"""
from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.members.models import (
    Membership, MembershipFeePayment, MembershipFeeInstallment,
)
from apps.members import fees_service
from apps.members.fees_serializers import (
    MembershipFeePaymentSerializer,
    MembershipFeeInstallmentSerializer,
)


def _current_membership(request):
    if not request.user.is_authenticated:
        return None
    return Membership.all_objects.filter(
        user=request.user, association=request.association, is_active=True,
    ).first()


def _is_bureau(membership):
    if not membership:
        return False
    if getattr(membership, 'is_founder', False):
        return True
    from apps.members.models import BureauMember
    return BureauMember.all_objects.filter(
        association=membership.association, membership=membership, is_active=True,
    ).exists()


# ─── Configuration des frais ────────────────────────────────────────


class MembershipFeesConfigView(APIView):
    """Lit/modifie la config `Association.settings.membership_fees`."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        return Response(fees_service.get_config(request.association))

    def patch(self, request):
        member = _current_membership(request)
        if not _is_bureau(member):
            return Response(
                {'error': "Seul le bureau peut modifier la config des frais."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            updated = fees_service.set_config(request.association, request.data or {})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response(updated)


# ─── ViewSet pour les FeePayment ────────────────────────────────────


class MembershipFeePaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Lecture seule : la création passe par le service, l'enregistrement
    de paiement passe par une action dédiée."""
    serializer_class = MembershipFeePaymentSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['membership', 'fee_type', 'status', 'cycle']

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return MembershipFeePayment.all_objects.none()
        return (
            MembershipFeePayment.all_objects
            .filter(association=association)
            .select_related('membership__user', 'cycle', 'waived_by__user')
            .prefetch_related('installments')
        )

    # ─── Enregistrer un versement ───────────────────────────────
    @action(detail=True, methods=['post'])
    def record(self, request, pk=None):
        """
        Enregistre un versement (partiel ou complet).
        Body : { amount, payment_method?, notes? }
        """
        member = _current_membership(request)
        if not _is_bureau(member):
            return Response(
                {'error': "Seul le bureau peut enregistrer un versement."},
                status=status.HTTP_403_FORBIDDEN,
            )

        fp = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', '0')))
        except Exception:
            return Response({'error': "Montant invalide."}, status=400)

        try:
            result = fees_service.record_payment(
                fee_payment=fp,
                amount=amount,
                recorded_by=member,
                payment_method=request.data.get('payment_method', ''),
                notes=request.data.get('notes', ''),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

        return Response({
            'fee_payment': MembershipFeePaymentSerializer(result['fee_payment']).data,
            'installment': MembershipFeeInstallmentSerializer(result['installment']).data,
            'transaction_id': str(result['transaction'].id),
            'wallet_entry_id': str(result['wallet_entry'].id),
        })

    # ─── Vue d'ensemble ─────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='pending-overview')
    def pending_overview(self, request):
        """
        Vue d'ensemble pour le trésorier : tous les frais non soldés
        groupés par membre + totaux.
        """
        qs = self.get_queryset().filter(
            status__in=['pending', 'partial'],
        ).order_by('membership__user__first_name')

        # Agrégation par membre
        by_member: dict = {}
        for fp in qs:
            m_id = str(fp.membership_id)
            if m_id not in by_member:
                u = fp.membership.user
                by_member[m_id] = {
                    'membership_id': m_id,
                    'member_name': (
                        f"{u.first_name or ''} {u.last_name or ''}".strip()
                        or u.telephone
                    ),
                    'member_status': fp.membership.status,
                    'total_expected': Decimal('0'),
                    'total_paid': Decimal('0'),
                    'fees': [],
                }
            by_member[m_id]['total_expected'] += Decimal(fp.expected_amount)
            by_member[m_id]['total_paid'] += Decimal(fp.paid_amount)
            by_member[m_id]['fees'].append(
                MembershipFeePaymentSerializer(fp).data
            )

        out = list(by_member.values())
        for row in out:
            row['total_remaining'] = row['total_expected'] - row['total_paid']
            row['total_expected'] = str(row['total_expected'])
            row['total_paid'] = str(row['total_paid'])
            row['total_remaining'] = str(row['total_remaining'])
        return Response(out)

    # ─── Statut frais d'un membre spécifique ───────────────────
    @action(detail=False, methods=['get'], url_path='by-membership/(?P<membership_id>[^/]+)')
    def by_membership(self, request, membership_id=None):
        qs = self.get_queryset().filter(membership_id=membership_id)
        return Response(MembershipFeePaymentSerializer(qs, many=True).data)
