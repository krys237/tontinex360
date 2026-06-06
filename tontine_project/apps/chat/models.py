import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Conversation(TenantAwareModel):
    class ConversationType(models.TextChoices):
        PRIVATE = 'private', 'Privee (1 a 1)'
        GROUP = 'group', 'Groupe'
        BUREAU = 'bureau', 'Bureau'
        SESSION = 'session', 'Liee a une seance'
        GENERAL = 'general', 'General (toute l\'asso)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True)
    conv_type = models.CharField(max_length=20, choices=ConversationType.choices, default=ConversationType.PRIVATE)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, related_name='conversations_created',
    )
    linked_session = models.ForeignKey(
        'cycles.Session', on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations',
    )
    is_active = models.BooleanField(default=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    message_count = models.PositiveIntegerField(default=0)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'conversations'
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['association', '-last_message_at']),
            models.Index(fields=['association', 'conv_type']),
        ]

    def __str__(self):
        return self.name or f"Conversation {self.conv_type}"


class ConversationMember(TenantAwareModel):
    class Role(models.TextChoices):
        MEMBER = 'member', 'Membre'
        ADMIN = 'admin', 'Administrateur'

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='members')
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='chat_memberships',
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    last_read_at = models.DateTimeField(null=True, blank=True)
    unread_count = models.PositiveIntegerField(default=0)
    is_muted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'conversation_members'
        unique_together = ['conversation', 'membership']


class Message(TenantAwareModel):
    class MessageType(models.TextChoices):
        TEXT = 'text', 'Texte'
        IMAGE = 'image', 'Image'
        FILE = 'file', 'Fichier'
        VOICE = 'voice', 'Audio'
        SYSTEM = 'system', 'Systeme'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, related_name='messages_sent',
    )
    content = models.TextField()
    message_type = models.CharField(max_length=20, choices=MessageType.choices, default=MessageType.TEXT)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    attachments = models.JSONField(default=list, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'messages'
        ordering = ['created_at']
        indexes = [models.Index(fields=['conversation', 'created_at'])]

    def __str__(self):
        preview = self.content[:50] if self.content else '[vide]'
        return f"{self.sender}: {preview}"
