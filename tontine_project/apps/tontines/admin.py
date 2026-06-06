from django.contrib import admin
from apps.tontines.models import TontineType, MemberSubscription


@admin.register(TontineType)
class TontineTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'rate_mode', 'min_rate', 'max_rate', 'is_active']
    list_filter = ['association', 'rate_mode', 'is_active']
    search_fields = ['name']


@admin.register(MemberSubscription)
class MemberSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['membership', 'tontine_type', 'cycle', 'num_shares', 'rate_per_share', 'is_active']
    list_filter = ['association', 'tontine_type', 'is_active']
