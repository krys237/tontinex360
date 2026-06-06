from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.finance.views import (
    ContributionViewSet, LoanViewSet, LoanRepaymentViewSet,
    TreasuryAccountViewSet, TransactionViewSet,
    TontineBalancesView, TontineBalanceDetailView,
    ContributionCorrectionRequestViewSet,
)

router = DefaultRouter()
router.register('contributions', ContributionViewSet, basename='contribution')
router.register('loans', LoanViewSet, basename='loan')
router.register('loan-repayments', LoanRepaymentViewSet, basename='loan-repayment')
router.register('treasury', TreasuryAccountViewSet, basename='treasury')
router.register('transactions', TransactionViewSet, basename='transaction')
router.register(
    'correction-requests', ContributionCorrectionRequestViewSet,
    basename='contribution-correction-request',
)

urlpatterns = [
    path('', include(router.urls)),
    path('tontine-balances/', TontineBalancesView.as_view(), name='tontine-balances'),
    path('tontine-balances/<uuid:tontine_type_id>/', TontineBalanceDetailView.as_view(), name='tontine-balance-detail'),
]
