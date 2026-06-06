from django.utils import timezone


class NotificationService:
    @classmethod
    def notify(cls, association, recipient, notification_type, title,
               body='', data=None, channels=None):
        from apps.notifications.models import Notification, NotificationPreference

        prefs = NotificationPreference.all_objects.filter(membership=recipient).first()
        if prefs and notification_type in prefs.muted_types:
            return None

        if channels is None:
            channels = cls._resolve_channels(prefs)

        notifications = []
        for channel in channels:
            notif = Notification.objects.create(
                association=association, recipient=recipient,
                notification_type=notification_type, title=title,
                body=body, data=data or {}, channel=channel,
            )
            notifications.append(notif)
            cls._dispatch(notif)
        return notifications

    @classmethod
    def notify_all_members(cls, association, notification_type, title,
                           body='', data=None, exclude=None):
        from apps.members.models import Membership
        members = Membership.all_objects.filter(association=association, is_active=True)
        if exclude:
            members = members.exclude(id__in=[m.id for m in exclude])
        for member in members:
            cls.notify(association=association, recipient=member,
                       notification_type=notification_type, title=title,
                       body=body, data=data)

    @classmethod
    def notify_bureau(cls, association, notification_type, title, body='', data=None):
        from apps.members.models import BureauMember
        bureau = BureauMember.all_objects.filter(
            association=association, is_active=True,
        ).select_related('membership')
        for bm in bureau:
            cls.notify(association=association, recipient=bm.membership,
                       notification_type=notification_type, title=title,
                       body=body, data=data)

    @classmethod
    def mark_as_read(cls, notification_ids, membership):
        from apps.notifications.models import Notification
        Notification.all_objects.filter(
            id__in=notification_ids, recipient=membership,
        ).update(is_read=True, read_at=timezone.now())

    @classmethod
    def mark_all_as_read(cls, membership):
        from apps.notifications.models import Notification
        Notification.all_objects.filter(
            recipient=membership, is_read=False,
        ).update(is_read=True, read_at=timezone.now())

    @staticmethod
    def _resolve_channels(prefs):
        channels = ['in_app']
        if not prefs:
            return channels
        if prefs.whatsapp_enabled:
            channels.append('whatsapp')
        elif prefs.sms_enabled:
            channels.append('sms')
        if prefs.email_enabled:
            channels.append('email')
        return channels

    @staticmethod
    def _dispatch(notification):
        if notification.channel == 'in_app':
            notification.delivery_status = 'delivered'
            notification.sent_at = timezone.now()
            notification.save(update_fields=['delivery_status', 'sent_at'])
            # Push FCM best-effort en complément de l'in-app
            try:
                from apps.core.utils import notify_user
                user = getattr(notification.recipient, 'user', None)
                if user is not None:
                    notify_user(user, notification.title, notification.body or '')
            except Exception:
                pass
        # TODO: whatsapp, sms, email via Celery tasks
