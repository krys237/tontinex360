from django.contrib import admin
from apps.proxies.models import Proxy


@admin.register(Proxy)
class ProxyAdmin(admin.ModelAdmin):
    list_display = ('principal', 'proxy', 'session', 'tontine_type', 'status', 'requested_at')
    list_filter = ('status', 'association')
    search_fields = (
        'principal__user__telephone', 'principal__user__first_name', 'principal__user__last_name',
        'proxy__user__telephone', 'proxy__user__first_name', 'proxy__user__last_name',
    )
    readonly_fields = ('id', 'requested_at', 'approved_at', 'used_at', 'resulting_payout')
