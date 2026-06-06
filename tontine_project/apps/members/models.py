from datetime import datetime
import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager
###############################################################################################
import unicodedata
from django.utils.text import slugify

def _normalize(text: str) -> str:
    """
    Supprime accents + uppercase
    """
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    return text.upper()

###############################################################################################
class Membership(TenantAwareModel):
    """
    Lien User <-> Association.
    C'est l'identité d'un utilisateur DANS une association.
    Un User a autant de Membership qu'il a d'associations.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        ACTIVE = 'active', 'Actif'
        SUSPENDED = 'suspended', 'Suspendu'
        EXPELLED = 'expelled', 'Exclu'
        RESIGNED = 'resigned', 'Démissionnaire'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='memberships',
    )
    member_number = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    cni_number = models.CharField(max_length=100, blank=True)
    
    joined_date = models.DateField(auto_now_add=True)
    
    extra_data = models.JSONField(default=dict, blank=True, help_text=(
        "Champs personnalisés: profession, quartier, parrain_id, etc."
    ))

    is_active = models.BooleanField(default=True)
    is_founder = models.BooleanField(
        default=False,
        help_text="Vrai pour le fondateur de l'association (irrévocable, accès total).",
    )

    # Signature de référence (capturée à l'inscription ou plus tard).
    # Sert de référence visuelle pour comparer avec les signatures
    # apposées sur les bordereaux de réception.
    signature_reference = models.ImageField(
        upload_to='members/signatures/', null=True, blank=True,
        help_text="Signature de référence du membre.",
    )
    signature_reference_at = models.DateTimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'memberships'
        unique_together = ['association', 'user']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['association', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.first_name} @ {self.association.name}"
    
    def generate_member_number(self):
        """
        Génère un code unique du type: TNT240325ND01
        """
        # 1. SLUG → prendre 3 lettres
        slug = getattr(self.association, "slug", "")
        
        slug_part = _normalize(slug)[:3].ljust(3, "X")

        # 2. DATE
        date_part = datetime.now().strftime("%y%m%d")
        

        # 3. NOM → 2 lettres
        last_name = _normalize(self.user.last_name)
        name_part = last_name[:2].ljust(2, "X")

        # 4. BASE CODE
        base_code = f"{slug_part}{date_part}{name_part}"

        # 5. GESTION UNICITÉ
        counter = 1
        while True:
            suffix = f"{counter:02d}"
            member_number = f"{base_code}{suffix}"

            if not Membership.objects.filter(
                association=self.association,
                member_number=member_number
            ).exists():
                return member_number

            counter += 1
    
    def save(self, *args, **kwargs):
        if not self.member_number:
            self.member_number = self.generate_member_number()
        super().save(*args, **kwargs)


class Role(TenantAwareModel):
    """
    Rôle personnalisable par association.
    Permissions = liste de chaînes "app.action".
    Wildcards : "*" (tout), "finance.*" (toute l'app finance).
    """
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)

    permissions = models.JSONField(default=list, help_text=(
        '["members.view", "finance.collect", "tontine.manage"] '
        'Wildcards: "*", "finance.*"'
    ))

    is_bureau_role = models.BooleanField(default=False)
    is_system = models.BooleanField(
        default=False, help_text="Non supprimable, non modifiable",
    )
    hierarchy_level = models.PositiveIntegerField(
        default=0, help_text="0 = plus élevé",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'roles'
        unique_together = ['association', 'slug']
        ordering = ['hierarchy_level', 'name']

    def __str__(self):
        return self.name


class MemberRole(TenantAwareModel):
    """Attribution d'un rôle à un membre. Un membre peut avoir N rôles."""
    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name='roles',
    )
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name='members',
    )
    assigned_by = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='roles_assigned',
    )
    is_active = models.BooleanField(default=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'member_roles'
        unique_together = ['membership', 'role']


class BureauPosition(TenantAwareModel):
    """
    Position au bureau — personnalisable par association.
    Ex: Président, VP, Secrétaire, Trésorier, Commissaire...
    """
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_required = models.BooleanField(default=False)
    default_role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True,
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'bureau_positions'
        unique_together = ['association', 'slug']
        ordering = ['display_order']

    def __str__(self):
        return self.name


class BureauMember(TenantAwareModel):
    """
    Membre du bureau pour un cycle donné.
    cycle est nullable pour le fondateur (pas de cycle initial).
    """
    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name='bureau_positions',
    )
    position = models.ForeignKey(
        BureauPosition, on_delete=models.CASCADE, related_name='holders',
    )
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.CASCADE, related_name='bureau_members',
        null=True, blank=True,
    )

    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    designation_method = models.CharField(
        max_length=50, blank=True,
        help_text="fondateur, vote, nomination, statuts",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'bureau_members'
        indexes = [
            models.Index(fields=['association', 'cycle', 'is_active']),
        ]


class MembershipRequest(TenantAwareModel):
    """
    Demande d'adhésion à une association par un utilisateur externe,
    typiquement pour un nouveau cycle. Doit être validée par le bureau.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        APPROVED = 'approved', 'Approuvée'
        REJECTED = 'rejected', 'Rejetée'
        CANCELLED = 'cancelled', 'Annulée'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='membership_requests',
    )
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='membership_requests',
        help_text="Cycle pour lequel l'utilisateur souhaite adhérer (optionnel).",
    )
    motivation = models.TextField(
        blank=True, help_text="Lettre de motivation / raison de la demande.",
    )
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    reviewed_by = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='membership_requests_reviewed',
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resulting_membership = models.OneToOneField(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='originating_request',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'membership_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['user', 'status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['association', 'user'],
                condition=models.Q(status='pending'),
                name='unique_pending_membership_request_per_user',
            ),
        ]

    def __str__(self):
        return f"Demande de {self.user} pour {self.association} ({self.status})"


class Resignation(TenantAwareModel):
    """
    Demande de démission soumise par un membre actif.
    Validée par le bureau. À l'approbation, le membership devient RESIGNED.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        APPROVED = 'approved', 'Approuvée'
        REJECTED = 'rejected', 'Rejetée'
        CANCELLED = 'cancelled', 'Annulée'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name='resignations',
    )
    reason = models.TextField(help_text="Motif de démission obligatoire.")
    effective_date = models.DateField(
        null=True, blank=True,
        help_text="Date souhaitée d'effet (sinon date de l'approbation).",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    reviewed_by = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resignations_reviewed',
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'resignations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['membership', 'status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['association', 'membership'],
                condition=models.Q(status='pending'),
                name='unique_pending_resignation_per_membership',
            ),
        ]

    def __str__(self):
        return f"Démission de {self.membership} ({self.status})"


# =============================================================================
# IMPORT EN MASSE DE MEMBRES (Excel)
# =============================================================================


class MemberImportBatch(TenantAwareModel):
    """
    Lot d'import de membres depuis un fichier Excel.
    Trace tout : fichier source, qui l'a fait, mode (ajout direct / invitation),
    compteurs, statut global.
    """
    class Mode(models.TextChoices):
        DIRECT = 'direct', 'Ajout direct (memberships actifs immédiatement)'
        INVITE = 'invite', 'Envoyer une invitation à chaque ligne'

    class Status(models.TextChoices):
        PREVIEWED = 'previewed', 'Prévisualisé (non traité)'
        PROCESSING = 'processing', 'En cours de traitement'
        COMPLETED = 'completed', 'Traité'
        FAILED = 'failed', 'Échec global'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    imported_by = models.ForeignKey(
        Membership, on_delete=models.PROTECT, related_name='import_batches',
    )
    filename = models.CharField(max_length=255, blank=True)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.INVITE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PREVIEWED)

    total_rows = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)

    processed_at = models.DateTimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'member_import_batches'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', '-created_at']),
        ]


class MemberImportRow(TenantAwareModel):
    """
    Une ligne du fichier Excel, parsée et stockée pour audit.
    Lien faible vers le Membership ou Invitation créé (si succès).
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        SUCCESS = 'success', 'Succès'
        ERROR = 'error', 'Erreur'
        SKIPPED = 'skipped', 'Ignorée (déjà membre / doublon)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        MemberImportBatch, on_delete=models.CASCADE, related_name='rows',
    )
    row_number = models.PositiveIntegerField()
    raw_data = models.JSONField(default=dict)
    parsed_telephone = models.CharField(max_length=20, blank=True)
    parsed_first_name = models.CharField(max_length=100, blank=True)
    parsed_last_name = models.CharField(max_length=100, blank=True)
    parsed_email = models.EmailField(blank=True)
    parsed_member_number = models.CharField(max_length=50, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)

    resulting_membership = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='from_import_rows',
    )
    # invitation : FK paresseuse pour éviter une dépendance cyclique apps imports
    resulting_invitation_id = models.UUIDField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'member_import_rows'
        ordering = ['batch', 'row_number']
        indexes = [
            models.Index(fields=['batch', 'status']),
        ]


# =============================================================================
# FRAIS D'ADHÉSION (inscription + fond de membre)
# =============================================================================


class MembershipFeePayment(TenantAwareModel):
    """
    Frais d'adhésion d'un membre : inscription (one-shot, porte d'entrée) ou
    fond de membre (à vie OU par cycle selon `Association.settings.membership_fees`).

    Workflow :
    - À l'approbation d'une MembershipRequest (ou à l'acceptation d'une Invitation),
      un FeePayment est créé en PENDING pour chaque type de frais configuré dans
      l'association.
    - Le bureau enregistre les versements (partiel ou complet) via le service.
    - Quand `paid_amount >= expected_amount` → status passe à PAID, et si c'était
      l'inscription d'entrée, le Membership bascule en 'active'.
    - L'exonération (status='waived') passe par le workflow d'approbation
      (action_type='membership_fee.waive', double validation Président + Bureau).
    """
    class FeeType(models.TextChoices):
        REGISTRATION = 'registration', "Inscription (one-shot)"
        MEMBERSHIP_FUND = 'membership_fund', "Fond de membre"

    class Status(models.TextChoices):
        PENDING = 'pending', 'À payer'
        PARTIAL = 'partial', 'Paiement partiel'
        PAID = 'paid', 'Payé'
        WAIVED = 'waived', 'Exonéré'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name='fee_payments',
    )
    fee_type = models.CharField(max_length=20, choices=FeeType.choices)
    # Pour les fonds 'per_cycle' : lié à un cycle précis. Null = lifetime.
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fee_payments',
    )

    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )

    first_payment_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date du paiement final (ou de l'exonération).",
    )

    # Exonération via le workflow d'approbation
    waived_by = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fee_payments_waived',
    )
    waiver_reason = models.TextField(blank=True)

    notes = models.TextField(blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'membership_fee_payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['membership', 'fee_type']),
        ]
        constraints = [
            # Un seul payment INSCRIPTION par membre (one-shot lifetime)
            models.UniqueConstraint(
                fields=['membership', 'fee_type'],
                condition=models.Q(fee_type='registration'),
                name='unique_registration_per_membership',
            ),
            # Un seul fond 'lifetime' (cycle=NULL) par membre
            models.UniqueConstraint(
                fields=['membership', 'fee_type'],
                condition=models.Q(fee_type='membership_fund', cycle__isnull=True),
                name='unique_lifetime_fund_per_membership',
            ),
            # Un seul fond par cycle par membre (per_cycle)
            models.UniqueConstraint(
                fields=['membership', 'fee_type', 'cycle'],
                condition=models.Q(fee_type='membership_fund', cycle__isnull=False),
                name='unique_fund_per_cycle_per_membership',
            ),
        ]

    @property
    def remaining_amount(self):
        from decimal import Decimal
        return max(Decimal('0'), self.expected_amount - self.paid_amount)

    @property
    def progress_pct(self):
        if not self.expected_amount or self.expected_amount == 0:
            return 100.0
        return min(100.0, float(self.paid_amount / self.expected_amount) * 100.0)


class MembershipFeeInstallment(TenantAwareModel):
    """
    Trace de chaque versement individuel pour un MembershipFeePayment échelonné.
    Sert d'audit trail (qui a encaissé combien, quand, via quelle méthode).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        MembershipFeePayment, on_delete=models.CASCADE, related_name='installments',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_at = models.DateTimeField()
    payment_method = models.CharField(max_length=50, blank=True)
    recorded_by = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fee_installments_recorded',
    )
    # Liens faibles vers les traces comptables/wallet
    transaction_id = models.UUIDField(null=True, blank=True)
    wallet_entry_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'membership_fee_installments'
        ordering = ['paid_at']
