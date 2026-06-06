from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.invitations.views import CheckInvitationView, InvitationViewSet, LoginAndAcceptInvitationView, RegisterAndAcceptInvitationView, SendInvitationView, AcceptInvitationView

router = DefaultRouter()
router.register('list', InvitationViewSet, basename='invitation')

urlpatterns = [
    path('', include(router.urls)),
    path('send/', SendInvitationView.as_view(), name='send-invitation'),
    path('accept/', AcceptInvitationView.as_view(), name='accept-invitation'),
    path('check/<str:token>/', CheckInvitationView.as_view(), name='check-invitation'),
    path('register-and-accept/', RegisterAndAcceptInvitationView.as_view(), name='register-and-accept-invitation'),
    path('login-and-accept/', LoginAndAcceptInvitationView.as_view(), name='login-and-accept-invitation'),
]
