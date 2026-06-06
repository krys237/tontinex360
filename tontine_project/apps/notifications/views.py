from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.serializers import NotificationSerializer, NotificationPreferenceSerializer
from apps.notifications.services import NotificationService


class NotificationViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Notification.all_objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['is_read', 'notification_type']

    def get_queryset(self):
        qs = super().get_queryset()
        membership = self._get_membership()
        if membership:
            return qs.filter(recipient=membership)
        return qs.none()

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        ids = request.data.get('ids', [])
        membership = self._get_membership()
        if membership:
            NotificationService.mark_as_read(ids, membership)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        membership = self._get_membership()
        if membership:
            NotificationService.mark_all_as_read(membership)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        membership = self._get_membership()
        if not membership:
            return Response({'count': 0})
        count = Notification.all_objects.filter(
            recipient=membership, is_read=False,
        ).count()
        return Response({'count': count})


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        membership = request.user.get_membership_for(request.association)
        prefs, _ = NotificationPreference.all_objects.get_or_create(
            association=request.association, membership=membership,
        )
        return Response(NotificationPreferenceSerializer(prefs).data)

    def put(self, request):
        membership = request.user.get_membership_for(request.association)
        prefs, _ = NotificationPreference.all_objects.get_or_create(
            association=request.association, membership=membership,
        )
        serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
