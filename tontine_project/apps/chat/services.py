from django.db import models, transaction
from django.utils import timezone


class ChatService:
    @classmethod
    @transaction.atomic
    def create_private_conversation(cls, member_a, member_b):
        from apps.chat.models import Conversation, ConversationMember
        existing = Conversation.all_objects.filter(
            association=member_a.association,
            conv_type=Conversation.ConversationType.PRIVATE,
            members__membership=member_a,
        ).filter(members__membership=member_b).first()
        if existing:
            return existing

        conv = Conversation.objects.create(
            association=member_a.association,
            conv_type=Conversation.ConversationType.PRIVATE,
            created_by=member_a,
        )
        for m in [member_a, member_b]:
            ConversationMember.objects.create(
                association=member_a.association, conversation=conv, membership=m,
            )
        return conv

    @classmethod
    @transaction.atomic
    def get_or_create_general_conversation(cls, creator):
        """
        Récupère (ou crée) l'unique canal général de l'association — visible
        par TOUS les membres actifs. Tous les membres sont ajoutés en lecture/
        écriture ; le créateur est admin.
        """
        from apps.chat.models import Conversation, ConversationMember
        from apps.members.models import Membership

        conv = Conversation.all_objects.filter(
            association=creator.association,
            conv_type=Conversation.ConversationType.GENERAL,
        ).first()

        if conv is None:
            conv = Conversation.objects.create(
                association=creator.association,
                name=f"Canal {creator.association.name}",
                description="Canal général de l'association (lu par tous les membres).",
                conv_type=Conversation.ConversationType.GENERAL,
                created_by=creator,
            )

        # Synchronise les membres : tout membre actif doit y être
        existing_ids = set(
            ConversationMember.all_objects.filter(conversation=conv)
            .values_list('membership_id', flat=True)
        )
        active_members = Membership.all_objects.filter(
            association=creator.association, is_active=True,
        )
        for m in active_members:
            if m.id in existing_ids:
                continue
            ConversationMember.objects.create(
                association=creator.association, conversation=conv,
                membership=m,
                role=(
                    ConversationMember.Role.ADMIN if m.id == creator.id
                    else ConversationMember.Role.MEMBER
                ),
            )
        return conv

    @classmethod
    @transaction.atomic
    def create_group_conversation(cls, creator, name, member_ids, description=''):
        from apps.chat.models import Conversation, ConversationMember
        from apps.members.models import Membership

        conv = Conversation.objects.create(
            association=creator.association, name=name, description=description,
            conv_type=Conversation.ConversationType.GROUP, created_by=creator,
        )
        ConversationMember.objects.create(
            association=creator.association, conversation=conv,
            membership=creator, role=ConversationMember.Role.ADMIN,
        )
        members = Membership.all_objects.filter(
            id__in=member_ids, association=creator.association, is_active=True,
        ).exclude(id=creator.id)
        for member in members:
            ConversationMember.objects.create(
                association=creator.association, conversation=conv, membership=member,
            )
        return conv

    @classmethod
    @transaction.atomic
    def send_message(cls, conversation, sender, content,
                     message_type='text', reply_to=None, attachments=None):
        from apps.chat.models import Message, ConversationMember
        from apps.notifications.services import NotificationService

        msg = Message.objects.create(
            association=conversation.association, conversation=conversation,
            sender=sender, content=content, message_type=message_type,
            reply_to=reply_to, attachments=attachments or [],
        )
        conversation.last_message_at = msg.created_at
        conversation.message_count = (conversation.message_count or 0) + 1
        conversation.save(update_fields=['last_message_at', 'message_count'])

        ConversationMember.all_objects.filter(
            conversation=conversation,
        ).exclude(membership=sender).update(unread_count=models.F('unread_count') + 1)

        others = ConversationMember.all_objects.filter(
            conversation=conversation, is_muted=False,
        ).exclude(membership=sender).select_related('membership')
        for cm in others:
            NotificationService.notify(
                association=conversation.association, recipient=cm.membership,
                notification_type='new_message',
                title=f"Message de {sender.user.first_name}",
                body=content[:100],
                data={'conversation_id': str(conversation.id), 'message_id': str(msg.id)},
                channels=['in_app'],
            )
        return msg

    @classmethod
    def mark_conversation_read(cls, conversation, membership):
        from apps.chat.models import ConversationMember
        ConversationMember.all_objects.filter(
            conversation=conversation, membership=membership,
        ).update(last_read_at=timezone.now(), unread_count=0)

    @classmethod
    def delete_message(cls, message, membership):
        if message.sender_id != membership.id:
            raise PermissionError("Seul l\'auteur peut supprimer.")
        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.content = "[Message supprime]"
        message.save(update_fields=['is_deleted', 'deleted_at', 'content'])
