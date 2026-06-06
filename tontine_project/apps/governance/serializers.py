from rest_framework import serializers
from apps.governance.models import (
    Document, Election, ElectionCandidate, Vote,
    Announcement, AnnouncementReadStatus,
    Poll, PollOption, PollVote,
)


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'id', 'doc_type', 'title', 'content', 'version',
            'is_active', 'effective_date', 'file', 'approved_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ElectionCandidateSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    position_name = serializers.CharField(source='position.name', read_only=True)

    class Meta:
        model = ElectionCandidate
        fields = ['id', 'election', 'membership', 'member_name', 'position', 'position_name', 'votes_count', 'is_elected']
        read_only_fields = ['id', 'votes_count']

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"


class ElectionSerializer(serializers.ModelSerializer):
    candidates = ElectionCandidateSerializer(many=True, read_only=True)

    class Meta:
        model = Election
        fields = ['id', 'cycle', 'session', 'title', 'method', 'status', 'date', 'notes', 'candidates', 'created_at']
        read_only_fields = ['id', 'created_at']


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ['id', 'election', 'candidate', 'voter', 'created_at']
        read_only_fields = ['id', 'created_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'content', 'priority', 'priority_display',
            'audience', 'audience_display', 'is_pinned', 'is_published',
            'starts_at', 'ends_at', 'attachment',
            'author', 'author_name', 'is_read',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        if not obj.author or not obj.author.user:
            return None
        u = obj.author.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone

    def get_is_read(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        from apps.members.models import Membership
        membership = Membership.all_objects.filter(
            user=request.user, association=obj.association, is_active=True,
        ).first()
        if not membership:
            return False
        return AnnouncementReadStatus.all_objects.filter(
            announcement=obj, membership=membership,
        ).exists()


class AnnouncementReadStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementReadStatus
        fields = ['id', 'announcement', 'membership', 'read_at']
        read_only_fields = ['id', 'read_at']


# ─── Sondages (Polls) ────────────────────────────────────────────────


class PollOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollOption
        fields = ['id', 'label', 'display_order', 'votes_count']
        read_only_fields = ['id', 'votes_count']


class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)
    options_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False,
        help_text="[{label, display_order?}, ...] — créées avec le Poll.",
    )
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()
    is_open_now = serializers.SerializerMethodField()
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id', 'title', 'question', 'kind', 'kind_display',
            'status', 'status_display',
            'starts_at', 'ends_at',
            'is_anonymous', 'allow_change_vote', 'max_choices',
            'results_visible_before_close',
            'created_by', 'created_by_name',
            'options', 'options_input',
            'has_voted', 'is_open_now', 'total_votes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u = obj.created_by.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.telephone

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        from apps.members.models import Membership
        from apps.governance.poll_service import voter_has_voted
        membership = Membership.all_objects.filter(
            user=request.user, association=obj.association, is_active=True,
        ).first()
        if not membership:
            return False
        return voter_has_voted(obj, membership)

    def get_is_open_now(self, obj):
        from apps.governance.poll_service import is_open_now
        return is_open_now(obj)

    def get_total_votes(self, obj):
        if obj.status != 'closed' and not obj.results_visible_before_close:
            return None
        return sum(o.votes_count for o in obj.options.all())

    def create(self, validated_data):
        options_input = validated_data.pop('options_input', [])
        poll = super().create(validated_data)
        for idx, opt in enumerate(options_input):
            label = (opt.get('label') or '').strip()
            if not label:
                continue
            PollOption.all_objects.create(
                association=poll.association,
                poll=poll, label=label,
                display_order=opt.get('display_order', idx),
            )
        return poll
