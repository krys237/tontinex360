from django.contrib import admin
from apps.chat.models import Conversation, ConversationMember, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'conv_type', 'message_count', 'last_message_at']
    list_filter = ['association', 'conv_type']

@admin.register(ConversationMember)
class ConversationMemberAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'membership', 'role', 'unread_count', 'is_muted']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'sender', 'message_type', 'is_deleted', 'created_at']
    list_filter = ['association', 'message_type', 'is_deleted']
