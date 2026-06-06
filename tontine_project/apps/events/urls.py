from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.events.views import EventViewSet, EventAttendanceViewSet

router = DefaultRouter()
router.register('events', EventViewSet, basename='event')
router.register('attendances', EventAttendanceViewSet, basename='event-attendance')

urlpatterns = [path('', include(router.urls))]
