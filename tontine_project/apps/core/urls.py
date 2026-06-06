from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.core.views import (
    ChangePasswordFogot, ChangedPassword, RegisterView, LoginView, MeView,
    CreateAssociationView, SelectAssociationView, MyAssociationsView,
    UpdateAssociationView, UserViewSet, ValidateOTP, ResendOTPView,
    register_fcm_token,
)

from rest_framework.routers import DefaultRouter


router = DefaultRouter()

router.register('user',UserViewSet, basename = 'user')



urlpatterns = [
    path('', include(router.urls)),
    # Auth
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('valid-otp/', ValidateOTP.as_view(), name='valid-otp'),  # login
    path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
    path('change-fogot-password/', ChangePasswordFogot.as_view(), name='change-fogot-password'),
    path('change-password/', ChangedPassword.as_view(), name='change-fogot-otp'),


    # User
    path('me/', MeView.as_view(), name='me'),
    path("register-fcm-token/", register_fcm_token),

    # Associations
    path('associations/', MyAssociationsView.as_view(), name='my_associations'),
    path('associations/create/', CreateAssociationView.as_view(), name='create_association'),
    path('associations/select/', SelectAssociationView.as_view(), name='select_association'),
    path('associations/<slug:slug>/', UpdateAssociationView.as_view(), name='update_association'),
]
