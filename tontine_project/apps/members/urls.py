from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.members.views import (
    MembershipViewSet, RoleViewSet, BureauPositionViewSet, BureauMemberViewSet,
    MembershipRequestViewSet, ResignationViewSet,
)
from apps.members.import_views import MemberImportViewSet
from apps.members.fees_views import (
    MembershipFeesConfigView, MembershipFeePaymentViewSet,
)

router = DefaultRouter()
router.register('memberships', MembershipViewSet, basename='membership')
router.register('roles', RoleViewSet, basename='role')
router.register('bureau-positions', BureauPositionViewSet, basename='bureau-position')
router.register('bureau-members', BureauMemberViewSet, basename='bureau-member')
router.register('membership-requests', MembershipRequestViewSet, basename='membership-request')
router.register('resignations', ResignationViewSet, basename='resignation')
router.register('imports', MemberImportViewSet, basename='member-import')
router.register('fees', MembershipFeePaymentViewSet, basename='membership-fee-payment')

urlpatterns = [
    path('fees/config/', MembershipFeesConfigView.as_view(), name='membership-fees-config'),
    path('', include(router.urls)),
]
