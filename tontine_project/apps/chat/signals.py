from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.members.models import Membership


@receiver(post_save, sender=Membership)
def auto_add_to_general_chat(sender, instance, created, **kwargs):
    if not created or instance.status != Membership.Status.ACTIVE:
        return
    from apps.chat.models import Conversation, ConversationMember
    general = Conversation.all_objects.filter(
        association=instance.association,
        conv_type=Conversation.ConversationType.GENERAL,
    ).first()
    if general:
        ConversationMember.objects.get_or_create(
            association=instance.association,
            conversation=general, membership=instance,
        )
