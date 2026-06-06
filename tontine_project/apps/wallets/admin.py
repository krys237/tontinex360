from django.contrib import admin
from apps.wallets.models import Wallet, WalletEntry


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('membership', 'balance', 'total_credits', 'total_debits', 'is_frozen')
    list_filter = ('is_frozen', 'association')
    search_fields = ('membership__user__telephone', 'membership__user__first_name', 'membership__user__last_name')
    readonly_fields = ('balance', 'total_credits', 'total_debits', 'last_entry_at')


@admin.register(WalletEntry)
class WalletEntryAdmin(admin.ModelAdmin):
    list_display = ('wallet', 'direction', 'amount', 'source_type', 'session', 'balance_after', 'created_at')
    list_filter = ('direction', 'source_type', 'association')
    search_fields = ('wallet__membership__user__telephone', 'description')
    readonly_fields = tuple(f.name for f in WalletEntry._meta.fields)
