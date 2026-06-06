from django.urls import path

from apps.subscriptions.views import (
    CancelSubscriptionView,
    ChangePlanView,
    ConfirmPaymentView,
    InitiatePaymentView,
    MySubscriptionView,
    PaymentHistoryView,
    PlanListView,
    RecommendedPlanView,
)


urlpatterns = [
    # Lecture
    path('plans/', PlanListView.as_view(), name='plan-list'),
    path('my-subscription/', MySubscriptionView.as_view(), name='my-subscription'),
    path('recommended-plan/', RecommendedPlanView.as_view(), name='recommended-plan'),
    path('payments/', PaymentHistoryView.as_view(), name='payment-history'),

    # Actions (president uniquement)
    path('change-plan/', ChangePlanView.as_view(), name='change-plan'),
    path('cancel/', CancelSubscriptionView.as_view(), name='cancel-subscription'),
    path('payments/initiate/', InitiatePaymentView.as_view(), name='payment-initiate'),
    path(
        'payments/<uuid:payment_id>/confirm/',
        ConfirmPaymentView.as_view(),
        name='payment-confirm',
    ),
]
