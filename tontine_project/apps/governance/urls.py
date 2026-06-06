from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.governance.views import (
    DocumentViewSet, ElectionViewSet, ElectionCandidateViewSet, VoteViewSet,
    AnnouncementViewSet, PollViewSet,
)

router = DefaultRouter()
router.register('documents', DocumentViewSet, basename='document')
router.register('elections', ElectionViewSet, basename='election')
router.register('candidates', ElectionCandidateViewSet, basename='candidate')
router.register('votes', VoteViewSet, basename='vote')
router.register('announcements', AnnouncementViewSet, basename='announcement')
router.register('polls', PollViewSet, basename='poll')

urlpatterns = [path('', include(router.urls))]
