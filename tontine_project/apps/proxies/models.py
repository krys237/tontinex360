import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Proxy(TenantAwareModel):
    """
    Procuration : un membre titulaire (principal) délègue à un autre membre
    (proxy) la collecte physique de sa tontine pour une séance précise.

    La quote-part virtuelle (wallet, schedule de bénéficiaire) reste
    attribuée au principal. Seule la remise physique passe par le proxy.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        APPROVED = 'approved', 'Approuvée'
        USED = 'used', 'Utilisée'
        REJECTED = 'rejected', 'Rejetée'
        CANCELLED = 'cancelled', 'Annulée'
        EXPIRED = 'expired', 'Expirée'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    principal = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='proxies_given',
        help_text="Souscripteur titulaire qui délègue.",
    )
    proxy = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='proxies_received',
        help_text="Membre désigné pour collecter physiquement.",
    )

    session = models.ForeignKey(
        'cycles.Session', on_delete=models.CASCADE, related_name='proxies',
    )
    tontine_type = models.ForeignKey(
        'tontines.TontineType', on_delete=models.CASCADE,
        null=True, blank=True, related_name='proxies',
        help_text="Tontine spécifique. Null = vaut pour toutes les tontines de la séance.",
    )

    reason = models.TextField(blank=True)

    signed_document = models.FileField(
        upload_to='proxies/documents/', null=True, blank=True,
        help_text="Procuration signée scannée.",
    )
    signature_image = models.FileField(
        upload_to='proxies/signatures/', null=True, blank=True,
    )
    cni_image = models.FileField(
        upload_to='proxies/cni/', null=True, blank=True,
        help_text="CNI du principal pour vérification.",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )

    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='proxies_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    used_at = models.DateTimeField(null=True, blank=True)
    resulting_payout = models.ForeignKey(
        'cycles.BeneficiaryPayout', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='originating_proxies',
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'proxies'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['session', 'status']),
            models.Index(fields=['principal', 'status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['principal', 'session', 'tontine_type'],
                condition=models.Q(status__in=['pending', 'approved']),
                name='unique_active_proxy_per_session_tontine',
            ),
        ]

    def __str__(self):
        return f"Procuration {self.principal} → {self.proxy} (séance {self.session_id})"

    @property
    def is_consumable(self):
        return self.status == self.Status.APPROVED
