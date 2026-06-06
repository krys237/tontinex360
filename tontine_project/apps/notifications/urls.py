from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.notifications.views import NotificationViewSet, NotificationPreferenceView

router = DefaultRouter()
router.register('', NotificationViewSet, basename='notification')

urlpatterns = [
    path('preferences/', NotificationPreferenceView.as_view(), name='notification-preferences'),
    path('', include(router.urls)),
]
