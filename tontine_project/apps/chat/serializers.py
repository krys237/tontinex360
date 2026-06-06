from rest_framework import serializers
from apps.chat.models import Conversation, ConversationMember, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    reply_preview = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'content',
            'message_type', 'reply_to', 'reply_preview', 'attachments',
            'is_deleted', 'created_at',
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_deleted']

    def get_sender_name(self, obj):
        if obj.sender:
            return f"{obj.sender.user.first_name} {obj.sender.user.last_name}"
        return None

    def get_reply_preview(self, obj):
        if obj.reply_to and not obj.reply_to.is_deleted:
            return obj.reply_to.content[:80]
        return None


class ConversationMemberSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = ConversationMember
        fields ="__all__"

    def get_member_name(self, obj):
        return f"{obj.membership.user.first_name} {obj.membership.user.last_name}"


class ConversationSerializer(serializers.ModelSerializer):
    members = ConversationMemberSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    my_unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'name', 'conv_type', 'description', 'members',
            'last_message', 'last_message_at', 'message_count',
            'my_unread_count', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {'sender': msg.sender.user.first_name if msg.sender else None,
                    'content': msg.content[:80], 'at': msg.created_at}
        return None

    def get_my_unread_count(self, obj):
        membership = self.context.get('membership')
        if not membership:
            return 0
        cm = obj.members.filter(membership=membership).first()
        return cm.unread_count if cm else 0


class CreatePrivateConversationSerializer(serializers.Serializer):
    member_id = serializers.UUIDField()


class CreateGroupConversationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default='')
    member_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField()
    message_type = serializers.ChoiceField(choices=['text', 'image', 'file', 'voice'], default='text')
    reply_to = serializers.UUIDField(required=False, allow_null=True)
    attachments = serializers.ListField(required=False, default=[])
