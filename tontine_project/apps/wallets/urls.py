from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.wallets.views import (
    MyWalletView, MyWalletEntriesView, MyWalletSummaryView,
    WalletViewSet, ManualAdjustmentView, CycleSettlementView,
)

router = DefaultRouter()
router.register('wallets', WalletViewSet, basename='wallet')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', MyWalletView.as_view(), name='my-wallet'),
    path('me/entries/', MyWalletEntriesView.as_view(), name='my-wallet-entries'),
    path('me/summary/', MyWalletSummaryView.as_view(), name='my-wallet-summary'),
    path('manual-adjustment/', ManualAdjustmentView.as_view(), name='wallet-manual-adjustment'),
    path('cycle-settlement/', CycleSettlementView.as_view(), name='wallet-cycle-settlement'),
]
