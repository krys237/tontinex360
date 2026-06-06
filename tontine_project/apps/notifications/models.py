import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Notification(TenantAwareModel):
    class NotificationType(models.TextChoices):
        MEMBER_JOINED = 'member_joined', 'Nouveau membre'
        MEMBER_LEFT = 'member_left', 'Membre parti'
        ROLE_ASSIGNED = 'role_assigned', 'Role attribue'
        SESSION_REMINDER = 'session_reminder', 'Rappel de seance'
        SESSION_CREATED = 'session_created', 'Nouvelle seance'
        SESSION_CANCELLED = 'session_cancelled', 'Seance annulee'
        BENEFICIARY_SELECTED = 'beneficiary_selected', 'Beneficiaire designe'
        CONTRIBUTION_DUE = 'contribution_due', 'Cotisation due'
        CONTRIBUTION_RECEIVED = 'contribution_received', 'Cotisation recue'
        LOAN_APPROVED = 'loan_approved', 'Pret approuve'
        LOAN_REJECTED = 'loan_rejected', 'Pret refuse'
        LOAN_DUE = 'loan_due', 'Remboursement du'
        LOAN_OVERDUE = 'loan_overdue', 'Pret en retard'
        SANCTION_APPLIED = 'sanction_applied', 'Sanction appliquee'
        SANCTION_WAIVED = 'sanction_waived', 'Sanction graciee'
        ELECTION_STARTED = 'election_started', 'Election ouverte'
        ELECTION_RESULT = 'election_result', 'Resultat election'
        DOCUMENT_PUBLISHED = 'document_published', 'Document publie'
        EVENT_CREATED = 'event_created', 'Nouvel evenement'
        EVENT_REMINDER = 'event_reminder', 'Rappel evenement'
        NEW_MESSAGE = 'new_message', 'Nouveau message'
        TRIAL_EXPIRING = 'trial_expiring', 'Trial expire bientot'
        TRIAL_ENDED_RECOMMENDATION = 'trial_ended_recommendation', 'Fin de trial avec reco'
        SUBSCRIPTION_EXPIRED = 'subscription_expired', 'Abonnement expire'
        SUBSCRIPTION_RENEWAL_PENDING = 'subscription_renewal_pending', 'Renouvellement a confirmer'
        SUBSCRIPTION_TIER_RECOMMENDED = 'subscription_tier_recommended', 'Plan recommande'
        SESSION_REPORT_PUBLISHED = 'session_report_published', 'Rapport de seance publie'
        CUSTOM = 'custom', 'Personnalise'

    class Channel(models.TextChoices):
        IN_APP = 'in_app', 'In-app'
        EMAIL = 'email', 'Email'
        SMS = 'sms', 'SMS'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        PUSH = 'push', 'Push notification'

    class DeliveryStatus(models.TextChoices):
        PENDING = 'pending', 'En attente'
        SENT = 'sent', 'Envoye'
        DELIVERED = 'delivered', 'Delivre'
        FAILED = 'failed', 'Echoue'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='notifications',
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)

    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.IN_APP)
    delivery_status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'recipient', 'is_read']),
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"{self.notification_type} -> {self.recipient}"


class NotificationPreference(TenantAwareModel):
    membership = models.OneToOneField(
        'members.Membership', on_delete=models.CASCADE,
        related_name='notification_preferences',
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    whatsapp_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    muted_types = models.JSONField(default=list, blank=True)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'notification_preferences'
