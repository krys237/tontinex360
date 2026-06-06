from django.contrib import admin
from apps.notifications.models import Notification, NotificationPreference

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'notification_type', 'title', 'channel', 'is_read', 'created_at']
    list_filter = ['association', 'notification_type', 'channel', 'is_read']

@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['membership', 'email_enabled', 'sms_enabled', 'whatsapp_enabled']
