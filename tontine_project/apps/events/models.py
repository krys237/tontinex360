from django.db import models
import uuid
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Event(TenantAwareModel):
    """Evenements hors sessions: AG, reunions extraordinaires, fetes..."""
    class EventType(models.TextChoices):
        AG = 'ag', 'Assemblee Generale'
        AGE = 'age', 'AG Extraordinaire'
        MEETING = 'meeting', 'Reunion'
        CELEBRATION = 'celebration', 'Fete / Celebration'
        WORKSHOP = 'workshop', 'Atelier / Formation'
        OTHER = 'other', 'Autre'

    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planifie'
        CONFIRMED = 'confirmed', 'Confirme'
        IN_PROGRESS = 'in_progress', 'En cours'
        COMPLETED = 'completed', 'Termine'
        CANCELLED = 'cancelled', 'Annule'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    description = models.TextField(blank=True)
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.SET_NULL, null=True, blank=True, related_name='events',
    )
    organized_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='events_organized',
    )
    minutes = models.TextField(blank=True)
    attachments = models.JSONField(default=list, blank=True)

    # ── Audience : tous les membres OU sélection spécifique ─────────
    class AudienceMode(models.TextChoices):
        ALL = 'all', 'Tous les membres actifs'
        SPECIFIC = 'specific', 'Membres sélectionnés uniquement'

    audience_mode = models.CharField(
        max_length=20, choices=AudienceMode.choices, default=AudienceMode.ALL,
        help_text="ALL : tous les membres actifs · SPECIFIC : liste `invitees`.",
    )
    invitees = models.ManyToManyField(
        'members.Membership', blank=True,
        related_name='invited_events',
        help_text="Membres invités si audience_mode='specific'. Ignoré si 'all'.",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'events'
        ordering = ['-date']

    def __str__(self):
        return self.title


class EventAttendance(TenantAwareModel):
    """Presence a un evenement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='attendances')
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='event_attendances',
    )
    is_present = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'event_attendances'
        unique_together = ['event', 'membership']
