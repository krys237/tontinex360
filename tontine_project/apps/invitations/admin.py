from django.contrib import admin
from apps.invitations.models import Invitation

@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone', 'association', 'status', 'channel', 'expires_at']
    list_filter = ['association', 'status', 'channel']
    search_fields = ['email', 'phone', 'name']
