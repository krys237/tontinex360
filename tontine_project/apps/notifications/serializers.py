from rest_framework import serializers
from apps.notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'body', 'data',
            'channel', 'delivery_status', 'is_read', 'read_at',
            'sent_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'email_enabled', 'sms_enabled', 'whatsapp_enabled',
            'push_enabled', 'muted_types',
            'quiet_hours_start', 'quiet_hours_end',
        ]
