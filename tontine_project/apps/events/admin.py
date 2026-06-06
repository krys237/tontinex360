from django.contrib import admin
from apps.events.models import Event, EventAttendance

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['title', 'association', 'event_type', 'date', 'status']
    list_filter = ['association', 'event_type', 'status']

admin.site.register(EventAttendance)
