from rest_framework import serializers
from apps.invitations.models import Invitation

class InvitationSerializer(serializers.ModelSerializer):
    invited_by_name = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = [
            'id', 'invited_by', 'invited_by_name', 'email', 'phone', 'name',
            'token', 'role', 'message', 'status', 'channel',
            'expires_at', 'accepted_at', 'invite_url', 'created_at',
            'auto_mark_fees_paid',
        ]
        read_only_fields = ['id', 'token', 'status', 'accepted_at', 'created_at', 'invited_by']

    def get_invited_by_name(self, obj):
        return f"{obj.invited_by.user.first_name} {obj.invited_by.user.last_name}"

    def get_invite_url(self, obj):
        from django.conf import settings
        return f"{settings.FRONTEND_URL}/invite/{obj.token}"

class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    # Role.id est un BigAutoField (entier), pas un UUID
    role = serializers.IntegerField(required=False, allow_null=True)
    channel = serializers.ChoiceField(
        choices=['email', 'sms', 'whatsapp', 'link'], default='link', required=False,
    )
    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    auto_mark_fees_paid = serializers.BooleanField(required=False, default=False)

    def to_internal_value(self, data):
        # Tolère un role passé en str ("4"), vide, "null"
        d = dict(data) if not isinstance(data, dict) else dict(data)
        v = d.get('role')
        if v in (None, '', 'null'):
            d.pop('role', None)
        elif isinstance(v, str) and v.isdigit():
            d['role'] = int(v)
        return super().to_internal_value(d)

    def validate(self, attrs):
        if not attrs.get('email') and not attrs.get('phone'):
            raise serializers.ValidationError("Email ou téléphone requis.")
        return attrs

class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField()
