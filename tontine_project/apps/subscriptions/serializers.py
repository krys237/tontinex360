from rest_framework import serializers

from apps.subscriptions.models import Plan, Subscription, Payment


class PlanSerializer(serializers.ModelSerializer):
    is_unlimited_members = serializers.BooleanField(read_only=True)
    is_unlimited_cagnotte = serializers.BooleanField(read_only=True)

    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'slug', 'description',
            'price_monthly', 'price_yearly', 'currency',
            'max_members', 'max_monthly_cagnotte',
            'is_unlimited_members', 'is_unlimited_cagnotte',
            'trial_days', 'display_order',
        ]
        read_only_fields = fields


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    is_usable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'status', 'billing_cycle',
            'trial_start', 'trial_end',
            'current_period_start', 'current_period_end',
            'auto_renew', 'cancelled_at', 'is_usable',
        ]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'subscription', 'amount', 'currency', 'status',
            'payment_method', 'provider_reference', 'description',
            'paid_at', 'period_start', 'period_end', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ChangePlanSerializer(serializers.Serializer):
    """Demande d'upgrade/downgrade vers un autre plan."""
    plan_slug = serializers.SlugField()
    billing_cycle = serializers.ChoiceField(
        choices=Subscription.BillingCycle.choices,
        default=Subscription.BillingCycle.MONTHLY,
    )

    def validate_plan_slug(self, value):
        try:
            plan = Plan.objects.get(slug=value, is_active=True)
        except Plan.DoesNotExist:
            raise serializers.ValidationError("Plan introuvable ou inactif.")
        self.context['plan'] = plan
        return value


class InitiatePaymentSerializer(serializers.Serializer):
    """Initialise un paiement (status=pending) pour la prochaine periode."""
    billing_cycle = serializers.ChoiceField(
        choices=Subscription.BillingCycle.choices,
        default=Subscription.BillingCycle.MONTHLY,
    )
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
        default=Payment.PaymentMethod.MOBILE_MONEY,
    )


class ConfirmPaymentSerializer(serializers.Serializer):
    """Confirme manuellement un paiement (en attendant l'integration du hub)."""
    provider_reference = serializers.CharField(
        max_length=255, required=False, allow_blank=True,
    )
