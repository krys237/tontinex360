from rest_framework import serializers
from apps.events.models import Event, EventAttendance
from apps.members.models import Membership


class EventSerializer(serializers.ModelSerializer):
    audience_mode_display = serializers.CharField(
        source='get_audience_mode_display', read_only=True,
    )
    # Queryset par défaut = tous les memberships ; restreint dynamiquement à
    # l'association courante dans __init__ pour bloquer les fuites cross-tenant.
    invitees = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Membership.all_objects.all(),
    )
    invitee_names = serializers.SerializerMethodField()
    invitees_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'event_type', 'description',
            'date', 'start_time', 'end_time', 'location',
            'status', 'cycle', 'organized_by', 'minutes',
            'audience_mode', 'audience_mode_display',
            'invitees', 'invitee_names', 'invitees_count',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Restreint dynamiquement le queryset des invitees à l'association
        # courante (sécurité multi-tenant : un president ne peut pas inviter
        # un membre d'une autre association par erreur).
        association = self.context.get('association')
        if association is None and self.context.get('request'):
            association = getattr(self.context['request'], 'association', None)
        if association is not None:
            self.fields['invitees'].child_relation.queryset = (
                Membership.all_objects.filter(association=association, is_active=True)
            )

    def get_invitee_names(self, obj):
        if obj.audience_mode != Event.AudienceMode.SPECIFIC:
            return []
        rows = obj.invitees.select_related('user').all()
        return [
            {
                'id': str(m.id),
                'name': (
                    f"{m.user.first_name or ''} {m.user.last_name or ''}".strip()
                    or m.user.telephone
                ),
            }
            for m in rows
        ]

    def get_invitees_count(self, obj):
        if obj.audience_mode == Event.AudienceMode.ALL:
            # Approximation : tous les membres actifs de l'association
            from apps.members.models import Membership
            return Membership.all_objects.filter(
                association=obj.association, is_active=True,
            ).count()
        return obj.invitees.count()

    def validate(self, attrs):
        mode = attrs.get('audience_mode', getattr(self.instance, 'audience_mode', 'all'))
        invitees = attrs.get('invitees')
        if mode == Event.AudienceMode.SPECIFIC and invitees is not None and len(invitees) == 0:
            raise serializers.ValidationError({
                'invitees': "Sélectionnez au moins un membre quand audience_mode='specific'.",
            })
        return attrs


class EventAttendanceSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = EventAttendance
        fields = ['id', 'event', 'membership', 'member_name', 'is_present', 'notes']
        read_only_fields = ['id']

    def get_member_name(self, obj):
        u = obj.membership.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone
