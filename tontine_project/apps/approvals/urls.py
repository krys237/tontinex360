from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.approvals.views import BureauApprovalRequestViewSet


router = DefaultRouter()
router.register('', BureauApprovalRequestViewSet, basename='bureau-approval')

urlpatterns = [
    path('', include(router.urls)),
]
