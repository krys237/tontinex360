from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager
import uuid

class SanctionType(TenantAwareModel):
    """Types de sanctions personnalisables par association."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    default_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_fixed_amount = models.BooleanField(default=True)
    min_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_automatic = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'sanction_types'
        unique_together = ['association', 'slug']

    def __str__(self):
        return self.name


class Sanction(TenantAwareModel):
    """Sanction appliquee a un membre."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        PAID = 'paid', 'Payee'
        WAIVED = 'waived', 'Graciee'
        CONTESTED = 'contested', 'Contestee'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sanction_type = models.ForeignKey(SanctionType, on_delete=models.CASCADE, related_name='sanctions')
    membership = models.ForeignKey('members.Membership', on_delete=models.CASCADE, related_name='sanctions')
    session = models.ForeignKey('cycles.Session', on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sanctions_applied',
    )

    # ── Bordereau de paiement (signature électronique) ─────────────────
    receipt_signature = models.ImageField(
        upload_to='sanctions/signatures/', null=True, blank=True,
    )
    receipt_signed_at = models.DateTimeField(null=True, blank=True)
    receipt_device_info = models.JSONField(default=dict, blank=True)
    receipt_hash = models.CharField(max_length=64, blank=True)
    receipt_pdf = models.FileField(upload_to='sanctions/receipts/', null=True, blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'sanctions'
        indexes = [
            models.Index(fields=['association', 'membership', 'status']),
            models.Index(fields=['receipt_hash']),
        ]
