from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.cycles.views import (
    CycleViewSet, CycleTontineConfigViewSet,
    SessionViewSet, SessionAttendanceViewSet,
    SessionPotViewSet, BeneficiaryPayoutViewSet, AuctionBidViewSet,
    SessionReportViewSet, SessionReportAttachmentViewSet,
    OpenPotView, DistributeView, ProcessAuctionView, ClosePotView,
)

router = DefaultRouter()
router.register('cycles', CycleViewSet, basename='cycle')
router.register('configs', CycleTontineConfigViewSet, basename='cycle-config')
router.register('sessions', SessionViewSet, basename='session')
router.register('attendances', SessionAttendanceViewSet, basename='attendance')
router.register('pots', SessionPotViewSet, basename='pot')
router.register('payouts', BeneficiaryPayoutViewSet, basename='payout')
router.register('bids', AuctionBidViewSet, basename='bid')
router.register('session-reports', SessionReportViewSet, basename='session-report')
router.register(
    'session-report-attachments',
    SessionReportAttachmentViewSet,
    basename='session-report-attachment',
)

urlpatterns = [
    path('', include(router.urls)),

    # Actions sur la cagnotte
    path('sessions/<uuid:session_id>/open-pot/', OpenPotView.as_view(), name='open-pot'),
    path('pots/<uuid:pot_id>/distribute/', DistributeView.as_view(), name='distribute'),
    path('pots/<uuid:pot_id>/auction/', ProcessAuctionView.as_view(), name='process-auction'),
    path('pots/<uuid:pot_id>/close/', ClosePotView.as_view(), name='close-pot'),
]
