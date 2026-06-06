from rest_framework import serializers
from apps.sanctions.models import SanctionType, Sanction

class SanctionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SanctionType
        fields = ['id', 'name', 'slug', 'description', 'default_amount', 'is_fixed_amount', 'min_amount', 'max_amount', 'is_automatic', 'is_active']
        read_only_fields = ['id']

class SanctionSerializer(serializers.ModelSerializer):
    type_name = serializers.CharField(source='sanction_type.name', read_only=True)
    member_name = serializers.SerializerMethodField()
    has_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Sanction
        fields = [
            'id', 'sanction_type', 'type_name', 'membership', 'member_name',
            'session', 'amount', 'reason', 'status', 'paid_at', 'applied_by',
            'created_at',
            'receipt_number', 'receipt_pdf', 'receipt_hash', 'receipt_signed_at',
            'has_receipt',
        ]
        read_only_fields = [
            'id', 'created_at',
            'receipt_number', 'receipt_pdf', 'receipt_hash', 'receipt_signed_at',
            'has_receipt',
        ]

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"

    def get_has_receipt(self, obj):
        return bool(obj.receipt_pdf)
