from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAuthenticated

from apps.subscriptions.models import Payment, Plan, Subscription
from apps.subscriptions.serializers import (
    ChangePlanSerializer,
    ConfirmPaymentSerializer,
    InitiatePaymentSerializer,
    PaymentSerializer,
    PlanSerializer,
    SubscriptionSerializer,
)
from apps.subscriptions.services import (
    SubscriptionService,
    get_recommended_plan,
)


# =============================================================================
# HELPERS
# =============================================================================

def _get_active_subscription(request):
    association = getattr(request, 'association', None)
    if not association:
        raise NotFound("Aucune association selectionnee.")
    subscription = getattr(association, 'subscription', None)
    if not subscription:
        raise NotFound("Pas d'abonnement pour cette association.")
    return subscription


def _check_can_manage_subscription(user, association):
    """Seuls le president ou un membre avec la permission `subscription.manage`
    peuvent gerer l'abonnement."""
    from apps.members.models import MemberRole, Membership

    membership = Membership.all_objects.filter(
        user=user, association=association, is_active=True,
    ).first()
    if not membership:
        raise PermissionDenied("Vous n'etes pas membre de cette association.")

    roles = MemberRole.all_objects.filter(
        membership=membership, is_active=True,
    ).select_related('role')

    for member_role in roles:
        role = member_role.role
        perms = role.permissions or []
        if (
            '*' in perms
            or 'subscription.*' in perms
            or 'subscription.manage' in perms
            or role.slug in ('fondateur', 'president')
        ):
            return membership

    raise PermissionDenied(
        "Seul le president peut gerer l'abonnement de l'association."
    )


# =============================================================================
# LECTURE
# =============================================================================

class PlanListView(generics.ListAPIView):
    """Liste publique des plans disponibles."""
    queryset = Plan.objects.filter(is_active=True)
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]


class MySubscriptionView(APIView):
    """Voir l'abonnement de l'association active."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subscription = _get_active_subscription(request)
        return Response(SubscriptionSerializer(subscription).data)


class PaymentHistoryView(generics.ListAPIView):
    """Historique des paiements de l'association active."""
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return Payment.objects.none()
        subscription = getattr(association, 'subscription', None)
        if not subscription:
            return Payment.objects.none()
        return Payment.objects.filter(subscription=subscription)


class RecommendedPlanView(APIView):
    """
    Plan recommande selon l'activite des 90 derniers jours.
    Utile pour le dashboard front : afficher le plan suggere et les metriques.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        association = getattr(request, 'association', None)
        if not association:
            raise NotFound("Aucune association selectionnee.")

        plan, metrics = get_recommended_plan(association)
        return Response({
            'recommended_plan': PlanSerializer(plan).data,
            'metrics': {
                'monthly_cagnotte': str(metrics['monthly_cagnotte']),
                'members_count': metrics['members_count'],
                'window_days': metrics['window_days'],
            },
        })


# =============================================================================
# ACTIONS
# =============================================================================

class ChangePlanView(APIView):
    """Upgrade ou downgrade vers un autre plan."""
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePlanSerializer

    def post(self, request):
        subscription = _get_active_subscription(request)
        _check_can_manage_subscription(request.user, subscription.association)

        serializer = ChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_plan = serializer.context['plan']
        billing_cycle = serializer.validated_data['billing_cycle']

        SubscriptionService.change_plan(subscription, new_plan, billing_cycle)
        return Response(SubscriptionSerializer(subscription).data)


class InitiatePaymentView(APIView):
    """Cree un Payment en `pending` pour la prochaine periode."""
    permission_classes = [IsAuthenticated]
    serializer_class = InitiatePaymentSerializer

    def post(self, request):
        subscription = _get_active_subscription(request)
        _check_can_manage_subscription(request.user, subscription.association)

        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = SubscriptionService.initiate_payment(
            subscription=subscription,
            billing_cycle=serializer.validated_data['billing_cycle'],
            payment_method=serializer.validated_data['payment_method'],
        )
        return Response(
            PaymentSerializer(payment).data, status=status.HTTP_201_CREATED,
        )


class ConfirmPaymentView(APIView):
    """
    Confirme manuellement un paiement (en attendant le hub de paiement).
    Le signal post_save sur Payment activera la subscription automatiquement.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConfirmPaymentSerializer

    def post(self, request, payment_id):
        subscription = _get_active_subscription(request)
        _check_can_manage_subscription(request.user, subscription.association)

        try:
            payment = Payment.objects.get(id=payment_id, subscription=subscription)
        except Payment.DoesNotExist:
            raise NotFound("Paiement introuvable.")

        if payment.status not in (Payment.Status.PENDING, Payment.Status.FAILED):
            return Response(
                {'error': f'Paiement deja en statut {payment.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ConfirmPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        SubscriptionService.confirm_payment(
            payment,
            provider_reference=serializer.validated_data.get('provider_reference', ''),
        )

        # On recharge la subscription pour renvoyer son nouvel etat
        subscription.refresh_from_db()
        return Response({
            'payment': PaymentSerializer(payment).data,
            'subscription': SubscriptionSerializer(subscription).data,
        })


class CancelSubscriptionView(APIView):
    """Annule le renouvellement automatique (l'abonnement reste actif jusqu'a la fin)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone

        subscription = _get_active_subscription(request)
        _check_can_manage_subscription(request.user, subscription.association)

        subscription.auto_renew = False
        subscription.cancelled_at = timezone.now()
        subscription.save(update_fields=['auto_renew', 'cancelled_at', 'updated_at'])

        return Response(SubscriptionSerializer(subscription).data)
