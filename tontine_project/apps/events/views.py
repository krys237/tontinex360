from django.db import transaction as db_transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.events.models import Event, EventAttendance
from apps.events.serializers import EventSerializer, EventAttendanceSerializer


def _resolve_target_members(event):
    """
    Liste des `Membership` concernés par l'événement, selon `audience_mode`.

    - 'all'      : tous les membres actifs de l'association
    - 'specific' : la liste `invitees` exclusivement
    """
    from apps.members.models import Membership
    if event.audience_mode == Event.AudienceMode.SPECIFIC:
        return list(event.invitees.all())
    return list(Membership.all_objects.filter(
        association=event.association, is_active=True,
    ))


class EventViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Event.all_objects.prefetch_related('invitees__user')
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['event_type', 'status', 'cycle', 'audience_mode']

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['association'] = getattr(self.request, 'association', None)
        return ctx

    def _current_membership(self):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            user=self.request.user,
            association=self.request.association,
            is_active=True,
        ).first()

    @db_transaction.atomic
    def perform_create(self, serializer):
        """À la création : persiste l'event + pré-crée les EventAttendance des
        membres concernés + envoie une notification ciblée."""
        membership = self._current_membership()
        event = serializer.save(
            association=self.request.association,
            organized_by=membership,
        )
        self._sync_attendances(event)
        self._notify_invitees(event, kind='created')

    @db_transaction.atomic
    def perform_update(self, serializer):
        existing = self.get_object()
        old_mode = existing.audience_mode
        old_invitee_ids = set(existing.invitees.values_list('id', flat=True))

        event = serializer.save()
        new_invitee_ids = set(event.invitees.values_list('id', flat=True))

        if event.audience_mode != old_mode or new_invitee_ids != old_invitee_ids:
            self._sync_attendances(event)

    def _sync_attendances(self, event):
        """
        Crée les EventAttendance manquants pour les membres ciblés.
        Ne supprime PAS les attendances déjà saisies pour préserver les pointages.
        """
        targets = _resolve_target_members(event)
        existing_ids = set(
            EventAttendance.all_objects.filter(event=event)
            .values_list('membership_id', flat=True)
        )
        to_create = [
            EventAttendance(
                association=event.association,
                event=event,
                membership=m,
                is_present=False,
            )
            for m in targets if m.id not in existing_ids
        ]
        if to_create:
            EventAttendance.all_objects.bulk_create(to_create)

    def _notify_invitees(self, event, *, kind='created'):
        """Notification FCM + in-app uniquement aux membres concernés."""
        try:
            from apps.notifications.services import NotificationService
            targets = _resolve_target_members(event)
            title_prefix = "📅 Nouvel événement" if kind == 'created' else "📅 Événement mis à jour"
            title = f"{title_prefix} : {event.title}"
            body = (
                f"{event.get_event_type_display()} · {event.date}"
                + (f" · {event.location}" if event.location else '')
            )
            data = {'event_id': str(event.id), 'audience_mode': event.audience_mode}
            for m in targets:
                NotificationService.notify(
                    association=event.association,
                    recipient=m,
                    notification_type='event_invite',
                    title=title, body=body, data=data,
                )
        except Exception:
            # Notification best-effort : ne pas faire échouer la création
            pass

    @action(detail=True, methods=['post'], url_path='resync-attendances')
    def resync_attendances(self, request, pk=None):
        """Force la création des EventAttendance manquants (utile si on
        modifie la liste des invitees après création)."""
        event = self.get_object()
        before = EventAttendance.all_objects.filter(event=event).count()
        self._sync_attendances(event)
        after = EventAttendance.all_objects.filter(event=event).count()
        return Response({
            'created': max(0, after - before),
            'total': after,
        })


class EventAttendanceViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = EventAttendance.all_objects.select_related('membership__user')
    serializer_class = EventAttendanceSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['event']
