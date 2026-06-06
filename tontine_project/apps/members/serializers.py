from rest_framework import serializers
from apps.members.models import (
    Membership, Role, MemberRole, BureauPosition, BureauMember,
    MembershipRequest, Resignation,
)
from apps.core.serializers import UserSerializer


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'slug', 'description', 'permissions',
            'is_bureau_role', 'is_system', 'hierarchy_level',
        ]
        read_only_fields = ['id']

    def validate_slug(self, value):
        request = self.context.get('request')
        association = getattr(request, 'association', None) if request else None
        if not association:
            return value

        qs = Role.all_objects.filter(association=association, slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                f"Un rôle avec le slug '{value}' existe déjà dans cette association."
            )
        return value


class MemberRoleSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.all_objects.all(), source='role', write_only=True,
    )

    class Meta:
        model = MemberRole
        fields = ['id', 'role', 'role_id', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    roles = MemberRoleSerializer(many=True, read_only=True)
    has_signature = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'member_number', 'status',
            'joined_date', 'extra_data', 'is_active', 'is_founder', 'roles',
            'signature_reference', 'signature_reference_at', 'has_signature',
        ]
        read_only_fields = [
            'id', 'joined_date', 'is_founder',
            'signature_reference_at', 'has_signature',
        ]

    def get_has_signature(self, obj):
        return bool(obj.signature_reference)


class MembershipListSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes."""
    user_name = serializers.SerializerMethodField()
    user_telephone = serializers.CharField(source='user.telephone', read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user_name', 'user_telephone', 'member_number', 'status', 'is_active', 'is_founder']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"


class BureauPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BureauPosition
        fields = [
            'id', 'name', 'slug', 'description',
            'display_order', 'is_required', 'default_role',
        ]
        read_only_fields = ['id']


class BureauMemberSerializer(serializers.ModelSerializer):
    membership = MembershipListSerializer(read_only=True)
    position = BureauPositionSerializer(read_only=True)

    class Meta:
        model = BureauMember
        fields = [
            'id', 'membership', 'position', 'cycle',
            'start_date', 'end_date', 'is_active', 'designation_method',
        ]
        read_only_fields = ['id']


class MembershipRequestCreateSerializer(serializers.ModelSerializer):
    """Soumission d'une demande d'adhésion par un utilisateur."""
    class Meta:
        model = MembershipRequest
        fields = [
            'cycle', 'motivation',
            'contact_phone', 'contact_email',
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        association = getattr(request, 'association', None) if request else None
        user = request.user if request else None

        if not association or not user or not user.is_authenticated:
            raise serializers.ValidationError("Contexte invalide.")

        if Membership.all_objects.filter(
            association=association, user=user, is_active=True,
        ).exists():
            raise serializers.ValidationError(
                "Vous êtes déjà membre actif de cette association."
            )

        if MembershipRequest.all_objects.filter(
            association=association, user=user,
            status=MembershipRequest.Status.PENDING,
        ).exists():
            raise serializers.ValidationError(
                "Une demande est déjà en attente pour votre compte."
            )

        cycle = attrs.get('cycle')
        if cycle and cycle.association_id != association.id:
            raise serializers.ValidationError(
                {'cycle': "Ce cycle n'appartient pas à cette association."}
            )

        return attrs


class MembershipRequestSerializer(serializers.ModelSerializer):
    """Lecture d'une demande d'adhésion."""
    user = UserSerializer(read_only=True)
    reviewed_by = MembershipListSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = MembershipRequest
        fields = [
            'id', 'user', 'cycle', 'motivation',
            'contact_phone', 'contact_email',
            'status', 'status_display',
            'reviewed_by', 'review_note', 'reviewed_at',
            'resulting_membership',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class MembershipRequestReviewSerializer(serializers.Serializer):
    """Approbation / rejet d'une demande d'adhésion."""
    review_note = serializers.CharField(required=False, allow_blank=True, default='')


class ResignationCreateSerializer(serializers.ModelSerializer):
    """Soumission d'une démission par un membre."""
    class Meta:
        model = Resignation
        fields = ['reason', 'effective_date']

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le motif de démission est obligatoire.")
        return value

    def validate(self, attrs):
        membership = self.context.get('membership')
        if not membership:
            raise serializers.ValidationError(
                "Vous devez être membre actif pour soumettre une démission."
            )

        if Resignation.all_objects.filter(
            membership=membership, status=Resignation.Status.PENDING,
        ).exists():
            raise serializers.ValidationError(
                "Une démission est déjà en attente pour votre compte."
            )

        if membership.status == Membership.Status.RESIGNED or not membership.is_active:
            raise serializers.ValidationError(
                "Votre adhésion n'est plus active."
            )
        return attrs


class ResignationSerializer(serializers.ModelSerializer):
    """Lecture d'une démission."""
    membership = MembershipListSerializer(read_only=True)
    reviewed_by = MembershipListSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Resignation
        fields = [
            'id', 'membership', 'reason', 'effective_date',
            'status', 'status_display',
            'reviewed_by', 'review_note', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class ResignationReviewSerializer(serializers.Serializer):
    """Approbation / rejet d'une démission."""
    review_note = serializers.CharField(required=False, allow_blank=True, default='')
    effective_date = serializers.DateField(required=False, allow_null=True)
