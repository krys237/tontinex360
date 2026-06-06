from rest_framework import serializers
from apps.approvals.models import BureauApprovalRequest


class BureauApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    president_approval_name = serializers.SerializerMethodField()
    bureau_approval_name = serializers.SerializerMethodField()
    bureau_approval_2_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = BureauApprovalRequest
        fields = [
            'id', 'action_type', 'target_model', 'target_id',
            'requested_by', 'requested_by_name',
            'payload', 'original_snapshot', 'reason', 'summary',
            'requires_triple',
            'president_approval', 'president_approval_name', 'president_approval_at',
            'bureau_approval', 'bureau_approval_name', 'bureau_approval_at',
            'bureau_approval_2', 'bureau_approval_2_name', 'bureau_approval_2_at',
            'rejected_by', 'rejected_by_name', 'rejection_reason',
            'status', 'applied_at', 'expires_at', 'is_expired',
            'apply_error', 'side_effects', 'created_at',
        ]
        read_only_fields = [
            'id', 'requested_by',
            'requires_triple',
            'president_approval', 'president_approval_at',
            'bureau_approval', 'bureau_approval_at',
            'bureau_approval_2', 'bureau_approval_2_at',
            'rejected_by', 'rejection_reason',
            'status', 'applied_at', 'expires_at',
            'apply_error', 'side_effects', 'created_at',
            'summary', 'original_snapshot',
        ]

    def _name(self, m):
        return f"{m.user.first_name} {m.user.last_name}" if m else None

    def get_requested_by_name(self, obj): return self._name(obj.requested_by)
    def get_president_approval_name(self, obj): return self._name(obj.president_approval)
    def get_bureau_approval_name(self, obj): return self._name(obj.bureau_approval)
    def get_bureau_approval_2_name(self, obj): return self._name(obj.bureau_approval_2)
    def get_rejected_by_name(self, obj): return self._name(obj.rejected_by)

    def get_is_expired(self, obj):
        from apps.approvals.service import is_expired
        return is_expired(obj)
