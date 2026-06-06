from django.contrib import admin
from apps.governance.models import Document, Election, ElectionCandidate, Vote

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'association', 'doc_type', 'version', 'is_active']
    list_filter = ['association', 'doc_type', 'is_active']

@admin.register(Election)
class ElectionAdmin(admin.ModelAdmin):
    list_display = ['title', 'association', 'method', 'status', 'date']
    list_filter = ['association', 'status']

admin.site.register(ElectionCandidate)
admin.site.register(Vote)
