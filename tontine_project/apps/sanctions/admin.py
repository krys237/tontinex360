from django.contrib import admin
from apps.sanctions.models import SanctionType, Sanction

@admin.register(SanctionType)
class SanctionTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'default_amount', 'is_automatic', 'is_active']
    list_filter = ['association', 'is_automatic', 'is_active']

@admin.register(Sanction)
class SanctionAdmin(admin.ModelAdmin):
    list_display = ['membership', 'sanction_type', 'amount', 'status', 'created_at']
    list_filter = ['association', 'status', 'sanction_type']
