import uuid
import secrets
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Invitation(TenantAwareModel):
    """Invitation a rejoindre une association."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        ACCEPTED = 'accepted', 'Acceptee'
        DECLINED = 'declined', 'Refusee'
        EXPIRED = 'expired', 'Expiree'
        REVOKED = 'revoked', 'Revoquee'

    class Channel(models.TextChoices):
        EMAIL = 'email', 'Email'
        SMS = 'sms', 'SMS'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        LINK = 'link', 'Lien direct'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invited_by = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='invitations_sent',
    )

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    name = models.CharField(max_length=150, blank=True)

    token = models.CharField(max_length=64, unique=True, db_index=True, default=secrets.token_urlsafe)
    role = models.ForeignKey('members.Role', on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.LINK)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    resulting_membership = models.OneToOneField(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='from_invitation',
    )

    # Frais d'adhésion : si True, les frais (inscription + fond) seront créés
    # avec status='paid' à l'acceptation. Permet au président d'inviter des
    # membres déjà à jour sans repasser par les versements.
    auto_mark_fees_paid = models.BooleanField(
        default=False,
        help_text=(
            "Si True, les frais d'adhésion sont marqués comme 'paid' à "
            "l'acceptation (cas où le président invite un membre déjà à jour)."
        ),
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'invitations'
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['email', 'status']),
        ]

    def __str__(self):
        target = self.email or self.phone or self.name
        return f"Invitation -> {target} ({self.status})"

    @property
    def is_valid(self):
        from django.utils import timezone
        return self.status == self.Status.PENDING and self.expires_at > timezone.now()
