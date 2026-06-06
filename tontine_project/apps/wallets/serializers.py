from rest_framework import serializers
from apps.wallets.models import Wallet, WalletEntry


class WalletEntrySerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    signed_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    session_number = serializers.IntegerField(source='session.session_number', read_only=True)
    session_date = serializers.DateField(source='session.date', read_only=True)

    class Meta:
        model = WalletEntry
        fields = [
            'id', 'direction', 'direction_display',
            'amount', 'signed_amount',
            'source_type', 'source_type_display', 'source_id',
            'session', 'session_number', 'session_date',
            'cycle', 'distribution_batch',
            'total_distributed', 'members_count', 'per_member_amount',
            'description', 'balance_after', 'created_at',
        ]
        read_only_fields = fields


class WalletSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_number = serializers.CharField(source='membership.member_number', read_only=True)

    class Meta:
        model = Wallet
        fields = [
            'id', 'membership', 'member_name', 'member_number',
            'balance', 'total_credits', 'total_debits',
            'last_entry_at', 'is_frozen',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_member_name(self, obj):
        u = obj.membership.user
        return f"{u.first_name} {u.last_name}"


class ManualAdjustmentSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField()
    direction = serializers.ChoiceField(choices=['credit', 'debit'])
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0.01)
    description = serializers.CharField(max_length=255)
    session_id = serializers.UUIDField(required=False, allow_null=True)
    cycle_id = serializers.UUIDField(required=False, allow_null=True)


class CycleSettlementQuerySerializer(serializers.Serializer):
    cycle_id = serializers.UUIDField()
