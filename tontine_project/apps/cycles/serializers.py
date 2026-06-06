from rest_framework import serializers
from apps.cycles.models import (
    Cycle, CycleTontineConfig, Session, SessionAttendance,
    SessionPot, BeneficiaryPayout, AuctionBid,
    SessionReport, SessionReportAttachment,
)
from django.db import transaction

class CycleTontineConfigSerializer(serializers.ModelSerializer):
    tontine_name = serializers.CharField(source='tontine_type.name', read_only=True)
    default_method_display = serializers.CharField(
        source='get_default_method_display', read_only=True,
    )
    # Snapshot du pattern de restitution (lecture seule, vient de TontineType)
    payout_pattern = serializers.CharField(
        source='tontine_type.payout_pattern', read_only=True,
    )

    class Meta:
        model = CycleTontineConfig
        fields = [
            'id', 'cycle', 'tontine_type', 'tontine_name',
            'default_method', 'default_method_display',
            'allow_override', 'allowed_overrides',
            'auction_premium_destination', 'auction_premium_split_ratio',
            'config',
            'payout_pattern',
        ]
        read_only_fields = ['id', 'payout_pattern']

    def create(self, validated_data):
        """Si le bureau ne précise pas `default_method`, on hérite du
        `default_acquisition_method` du TontineType."""
        tontine_type = validated_data.get('tontine_type')
        if tontine_type and not validated_data.get('default_method'):
            validated_data['default_method'] = tontine_type.default_acquisition_method
        return super().create(validated_data)


class CycleSerializer(serializers.ModelSerializer):
    tontine_configs = CycleTontineConfigSerializer(many=True, read_only=True)
    session_count = serializers.SerializerMethodField()

    class Meta:
        model = Cycle
        fields = [
            'id', 'name', 'start_date', 'end_date', 'status',
            'session_frequency', 'default_session_day', 'default_session_time',
            'default_session_location', 'tontine_configs', 'session_count',
            'recurrence_kind', 'recurrence_nth', 'recurrence_weekday',
            'recurrence_day_of_month', 'sessions_generated_at',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'sessions_generated_at']

    def get_session_count(self, obj):
        return obj.sessions.count()

    def create(self, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            association = getattr(request, 'association', None) if request else None
            if association is None:
                raise serializers.ValidationError(
                    {"detail": "Aucune association active (header X-Tenant manquant)."}
                )

            # 🔒 LOCK pour éviter concurrence
            existing_cycle = Cycle.objects.select_for_update().filter(
                status__in=[Cycle.Status.DRAFT, Cycle.Status.ACTIVE],
                association=association,
            ).first()

            if existing_cycle:
                raise serializers.ValidationError({
                    "detail": f"Un cycle non terminé existe déjà : {existing_cycle.name}"
                })

            return super().create(validated_data)

class SessionSerializer(serializers.ModelSerializer):
    host_member_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'cycle', 'session_number', 'date',
            'start_time', 'end_time', 'location',
            'host_member', 'host_member_name',
            'status', 'minutes', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_host_member_name(self, obj):
        if not obj.host_member_id:
            return None
        u = obj.host_member.user
        full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return full or u.telephone


class SessionAttendanceSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = SessionAttendance
        fields = [
            'id', 'session', 'membership', 'member_name',
            'status', 'represented_by', 'notes',
        ]
        read_only_fields = ['id']

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"


class BeneficiaryPayoutSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    tontine_name = serializers.CharField(source='pot.tontine_type.name', read_only=True)
    session_number = serializers.IntegerField(source='pot.session.session_number', read_only=True)
    method_display = serializers.CharField(source='get_acquisition_method_display', read_only=True)
    has_receipt = serializers.SerializerMethodField()
    # ── Métadonnées du TontineType pour le front (lecture seule) ──
    tontine_contribution_kind = serializers.CharField(
        source='pot.tontine_type.contribution_kind', read_only=True, default='cash',
    )
    tontine_in_kind_unit_label = serializers.CharField(
        source='pot.tontine_type.in_kind_unit_label', read_only=True, default='',
    )

    class Meta:
        model = BeneficiaryPayout
        fields = [
            'id', 'pot', 'membership', 'member_name', 'tontine_name',
            'session_number', 'shares_claimed', 'shares_total', 'amount',
            'acquisition_method', 'method_display', 'schedule_order',
            'status', 'paid_at', 'notes', 'created_at',
            # Bordereau de réception
            'receipt_number', 'receipt_pdf', 'receipt_hash',
            'receipt_signed_at', 'has_receipt',
            # Versement en nature
            'is_in_kind', 'in_kind_quantity', 'in_kind_unit_label',
            'was_converted_to_cash',
            'tontine_contribution_kind', 'tontine_in_kind_unit_label',
        ]
        read_only_fields = [
            'id', 'acquisition_method', 'created_at',
            'receipt_number', 'receipt_pdf', 'receipt_hash',
            'receipt_signed_at', 'has_receipt',
            'tontine_contribution_kind', 'tontine_in_kind_unit_label',
        ]

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"

    def get_has_receipt(self, obj):
        return bool(obj.receipt_pdf)

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"

    
class SessionPotSerializer(serializers.ModelSerializer):
    tontine_name = serializers.CharField(source='tontine_type.name', read_only=True)
    total_available = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    method_display = serializers.CharField(source='get_effective_method_display', read_only=True)
    payouts = BeneficiaryPayoutSerializer(many=True, read_only=True)

    class Meta:
        model = SessionPot
        fields = [
            'id', 'session', 'tontine_type', 'tontine_name',
            'total_collected', 'carry_over_in', 'auction_premium_in',
            'total_available', 'total_distributed', 'remainder',
            'effective_method', 'method_display',
            'is_method_overridden', 'override_reason',
            'is_closed', 'payouts', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AuctionBidSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = AuctionBid
        fields = [
            'id', 'pot', 'membership', 'member_name',
            'bid_amount', 'status', 'resulting_payout', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'resulting_payout', 'created_at']

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"


class OpenPotSerializer(serializers.Serializer):
    tontine_type_id = serializers.UUIDField()
    override_method = serializers.ChoiceField(
        choices=['random', 'sequential', 'auction', 'vote', 'need_based', 'manual'],
        required=False, allow_null=True,
    )
    override_reason = serializers.CharField(required=False, default='')


class DistributeSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField()
    shares_claimed = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    proxy_id = serializers.UUIDField(
        required=False, allow_null=True,
        help_text="Procuration approuvée à utiliser. Si omis et qu'une procuration "
                  "approuvée existe pour ce membre/séance/tontine, elle est appliquée auto.",
    )


class ProcessAuctionSerializer(serializers.Serializer):
    winner_membership_id = serializers.UUIDField()
    bid_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    proxy_id = serializers.UUIDField(required=False, allow_null=True)


# ============================================================================
# RAPPORTS DE SEANCE
# ============================================================================

class SessionReportAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionReportAttachment
        fields = ['id', 'file', 'filename', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

    def create(self, validated_data):
        # Si filename non fourni, on derive depuis le fichier
        if not validated_data.get('filename') and validated_data.get('file'):
            validated_data['filename'] = validated_data['file'].name
        return super().create(validated_data)


class SessionReportSerializer(serializers.ModelSerializer):
    bureau_position = serializers.CharField(
        source='bureau_member.position.name', read_only=True,
    )
    bureau_position_slug = serializers.CharField(
        source='bureau_member.position.slug', read_only=True,
    )
    author_name = serializers.SerializerMethodField()
    session_number = serializers.IntegerField(
        source='session.session_number', read_only=True,
    )
    session_date = serializers.DateField(source='session.date', read_only=True)
    attachments = SessionReportAttachmentSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = SessionReport
        fields = [
            'id', 'session', 'session_number', 'session_date',
            'bureau_member', 'bureau_position', 'bureau_position_slug',
            'author_name', 'title', 'content',
            'is_published', 'published_at',
            'attachments', 'can_edit',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'bureau_member', 'is_published', 'published_at',
            'created_at', 'updated_at',
        ]

    def get_author_name(self, obj):
        user = obj.bureau_member.membership.user
        full = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return full or user.telephone

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.bureau_member.membership.user_id == request.user.id


class SessionReportCreateSerializer(serializers.ModelSerializer):
    """Le bureau_member est resolu automatiquement depuis l'utilisateur connecte."""
    publish = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = SessionReport
        fields = ['session', 'title', 'content', 'publish']

# class BeneficiaryScheduleSerializer(serializers.ModelSerializer):
#     member_name = serializers.SerializerMethodField()
#     tontine_name = serializers.CharField(source='tontine_type.name', read_only=True)

#     class Meta:
#         model = BeneficiarySchedule
#         fields = [
#             'id', 'cycle', 'tontine_type', 'tontine_name', 'session',
#             'membership', 'member_name', 'order', 'status', 'total_received',
#         ]
#         read_only_fields = ['id']

#     def get_member_name(self, obj):
#         return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"
