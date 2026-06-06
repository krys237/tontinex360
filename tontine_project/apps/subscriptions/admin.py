from django.contrib import admin

from apps.subscriptions.models import Payment, Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'slug', 'price_monthly', 'price_yearly', 'currency',
        'max_members', 'max_monthly_cagnotte', 'trial_days', 'is_active',
    ]
    list_filter = ['is_active', 'currency']
    ordering = ['display_order']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'association', 'plan', 'status', 'billing_cycle',
        'trial_end', 'current_period_end', 'auto_renew',
    ]
    list_filter = ['status', 'plan', 'billing_cycle', 'auto_renew']
    search_fields = ['association__name', 'association__slug']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'subscription', 'amount', 'currency', 'status',
        'payment_method', 'paid_at', 'created_at',
    ]
    list_filter = ['status', 'payment_method', 'currency']
    search_fields = ['provider_reference', 'subscription__association__name']
