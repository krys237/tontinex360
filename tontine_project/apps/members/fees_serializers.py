from rest_framework import serializers
from apps.members.models import MembershipFeePayment, MembershipFeeInstallment


class MembershipFeeInstallmentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MembershipFeeInstallment
        fields = [
            'id', 'amount', 'paid_at', 'payment_method',
            'recorded_by', 'recorded_by_name',
            'transaction_id', 'wallet_entry_id', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by or not obj.recorded_by.user:
            return None
        u = obj.recorded_by.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone


class MembershipFeePaymentSerializer(serializers.ModelSerializer):
    fee_type_display = serializers.CharField(source='get_fee_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    member_name = serializers.SerializerMethodField()
    cycle_name = serializers.CharField(source='cycle.name', read_only=True, default=None)
    waived_by_name = serializers.SerializerMethodField()
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    progress_pct = serializers.FloatField(read_only=True)
    installments = MembershipFeeInstallmentSerializer(many=True, read_only=True)

    class Meta:
        model = MembershipFeePayment
        fields = [
            'id', 'membership', 'member_name',
            'fee_type', 'fee_type_display',
            'cycle', 'cycle_name',
            'expected_amount', 'paid_amount', 'remaining_amount', 'progress_pct',
            'status', 'status_display',
            'first_payment_at', 'completed_at',
            'waived_by', 'waived_by_name', 'waiver_reason',
            'notes', 'installments',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'paid_amount', 'remaining_amount', 'progress_pct',
            'status', 'first_payment_at', 'completed_at',
            'waived_by', 'waived_by_name', 'waiver_reason',
            'installments', 'created_at', 'updated_at',
        ]

    def get_member_name(self, obj):
        if not obj.membership or not obj.membership.user:
            return None
        u = obj.membership.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone

    def get_waived_by_name(self, obj):
        if not obj.waived_by or not obj.waived_by.user:
            return None
        u = obj.waived_by.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone
