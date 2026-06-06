from rest_framework import serializers
from apps.finance.models import (
    Contribution, Loan, LoanRepayment, TreasuryAccount, Transaction,
    ContributionCorrectionRequest,
)


class ContributionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    has_receipt = serializers.SerializerMethodField()
    has_pending_correction = serializers.SerializerMethodField()
    # ── Métadonnées in_kind (hérité du TontineType) ──
    contribution_kind = serializers.CharField(
        source='tontine_type.contribution_kind', read_only=True, default='cash',
    )
    in_kind_unit_label = serializers.CharField(
        source='tontine_type.in_kind_unit_label', read_only=True, default='',
    )
    in_kind_unit_value = serializers.DecimalField(
        source='tontine_type.in_kind_unit_value',
        max_digits=12, decimal_places=2, read_only=True, default=None,
    )

    class Meta:
        model = Contribution
        fields = [
            'id', 'session', 'membership', 'member_name', 'tontine_type',
            'num_shares', 'rate_per_share', 'expected_amount', 'paid_amount',
            'status', 'paid_at', 'payment_method', 'receipt_number', 'created_at',
            'receipt_pdf', 'receipt_hash', 'receipt_signed_at', 'has_receipt',
            'has_pending_correction',
            'contribution_kind', 'in_kind_unit_label', 'in_kind_unit_value',
        ]
        read_only_fields = [
            'id', 'created_at',
            'receipt_pdf', 'receipt_hash', 'receipt_signed_at', 'has_receipt',
            'has_pending_correction',
            'contribution_kind', 'in_kind_unit_label', 'in_kind_unit_value',
        ]

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"

    def get_has_receipt(self, obj):
        return bool(obj.receipt_pdf)

    def get_has_pending_correction(self, obj):
        return obj.correction_requests.filter(
            status__in=['pending', 'pres_approved', 'bureau_approved'],
        ).exists()


class LoanRepaymentSerializer(serializers.ModelSerializer):
    has_receipt = serializers.SerializerMethodField()

    class Meta:
        model = LoanRepayment
        fields = [
            'id', 'loan', 'session', 'amount', 'paid_at', 'payment_method', 'notes',
            'receipt_number', 'receipt_pdf', 'receipt_hash', 'receipt_signed_at', 'has_receipt',
        ]
        read_only_fields = [
            'id', 'paid_at',
            'receipt_number', 'receipt_pdf', 'receipt_hash', 'receipt_signed_at', 'has_receipt',
        ]

    def get_has_receipt(self, obj):
        return bool(obj.receipt_pdf)


class LoanSerializer(serializers.ModelSerializer):
    repayments = LoanRepaymentSerializer(many=True, read_only=True)
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            'id', 'membership', 'amount', 'interest_rate', 'total_due',
            'total_repaid', 'remaining', 'session_granted', 'due_date',
            'purpose', 'status', 'approved_by', 'repayments', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_remaining(self, obj):
        return obj.total_due - obj.total_repaid


class TreasuryAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreasuryAccount
        fields = ['id', 'name', 'account_type', 'balance', 'description', 'is_active']
        read_only_fields = ['id', 'balance']


class ContributionCorrectionRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    tontine_type_name = serializers.CharField(source='contribution.tontine_type.name', read_only=True)
    expected_amount = serializers.DecimalField(
        source='contribution.expected_amount', max_digits=14, decimal_places=2, read_only=True,
    )
    president_approval_name = serializers.SerializerMethodField()
    bureau_approval_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = ContributionCorrectionRequest
        fields = [
            'id', 'contribution', 'requested_by', 'requested_by_name', 'member_name',
            'tontine_type_name', 'expected_amount',
            'original_paid_amount', 'new_paid_amount',
            'original_status', 'new_status', 'reason',
            'president_approval', 'president_approval_name', 'president_approval_at',
            'bureau_approval', 'bureau_approval_name', 'bureau_approval_at',
            'rejected_by', 'rejected_by_name', 'rejection_reason',
            'status', 'applied_at', 'expires_at', 'is_expired',
            'created_at',
        ]
        read_only_fields = [
            'id', 'requested_by', 'original_paid_amount', 'original_status',
            'new_status', 'president_approval', 'president_approval_at',
            'bureau_approval', 'bureau_approval_at', 'rejected_by',
            'rejection_reason', 'status', 'applied_at', 'expires_at',
            'created_at',
        ]

    def _name(self, m):
        return f"{m.user.first_name} {m.user.last_name}" if m else None

    def get_requested_by_name(self, obj): return self._name(obj.requested_by)
    def get_member_name(self, obj): return self._name(obj.contribution.membership)
    def get_president_approval_name(self, obj): return self._name(obj.president_approval)
    def get_bureau_approval_name(self, obj): return self._name(obj.bureau_approval)
    def get_rejected_by_name(self, obj): return self._name(obj.rejected_by)

    def get_is_expired(self, obj):
        from apps.finance.correction_service import is_expired
        return is_expired(obj)


class TransactionSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    tontine_name = serializers.CharField(source='tontine_type.name', read_only=True, default=None)

    class Meta:
        model = Transaction
        fields = [
            'id', 'account', 'account_name', 'tontine_type', 'tontine_name',
            'transaction_type', 'amount', 'is_debit',
            'balance_after', 'description', 'reference',
            'session', 'membership', 'recorded_by',
            'distribute_to_members', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'balance_after']
