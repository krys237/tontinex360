"""
Modèle générique d'approbation à double validation pour toutes les opérations
sensibles (corrections, ajustements, modifications irréversibles).

Le pattern reprend celui de `ContributionCorrectionRequest` mais factorisé :
- `action_type` identifie le handler à invoquer (ex: "loan_repayment.correction")
- `target_*` localise l'objet ciblé
- `payload` contient le diff proposé (JSON)
- `original_snapshot` figerait l'état avant pour traçabilité

Les handlers sont des classes Python enregistrées via `@register_handler`
dans `apps.approvals.handlers`.
"""
import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


APPROVAL_TTL = timedelta(hours=24)


class BureauApprovalRequest(TenantAwareModel):
    """Demande générique d'approbation Président + Bureau (24h)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        PRES_APPROVED = 'pres_approved', 'Validé par le Président'
        BUREAU_APPROVED = 'bureau_approved', 'Validé par un membre du Bureau'
        APPROVED = 'approved', 'Approuvé et appliqué'
        REJECTED = 'rejected', 'Rejeté'
        CANCELLED = 'cancelled', 'Annulé par le requérant'
        EXPIRED = 'expired', 'Expiré (24h dépassées)'
        FAILED = 'failed', "Échec de l'application"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    action_type = models.CharField(
        max_length=64,
        help_text="Identifiant du handler. Ex: 'loan_repayment.correction'.",
    )
    target_model = models.CharField(
        max_length=128,
        help_text="App.Model du ciblé. Ex: 'finance.LoanRepayment'.",
    )
    target_id = models.UUIDField()

    requested_by = models.ForeignKey(
        'members.Membership', on_delete=models.PROTECT,
        related_name='approval_requests_made',
    )

    # Diff proposé + snapshot avant
    payload = models.JSONField(default=dict, blank=True)
    original_snapshot = models.JSONField(default=dict, blank=True)
    reason = models.TextField()
    summary = models.TextField(
        blank=True, help_text="Texte humain pour notifications/UI",
    )

    # Approbations (Slot Président + Slot Bureau 1 + Slot Bureau 2 si triple)
    president_approval = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approval_requests_approved_pres',
    )
    president_approval_at = models.DateTimeField(null=True, blank=True)
    bureau_approval = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approval_requests_approved_bureau',
    )
    bureau_approval_at = models.DateTimeField(null=True, blank=True)
    bureau_approval_2 = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approval_requests_approved_bureau_2',
        help_text="2ᵉ slot bureau requis uniquement si `requires_triple=True`.",
    )
    bureau_approval_2_at = models.DateTimeField(null=True, blank=True)
    requires_triple = models.BooleanField(
        default=False,
        help_text="True = nécessite Président + 2 autres membres bureau distincts.",
    )

    # Rejet
    rejected_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approval_requests_rejected',
    )
    rejection_reason = models.TextField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    applied_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    apply_error = models.TextField(blank=True)

    # Pour audit : on stocke les ids des transactions/objets créés ou modifiés
    # par l'application (lien faible, JSON pour rester générique).
    side_effects = models.JSONField(default=dict, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'bureau_approval_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['association', 'action_type', 'status']),
            models.Index(fields=['target_model', 'target_id']),
        ]

    @classmethod
    def default_expires_at(cls):
        return timezone.now() + APPROVAL_TTL
