import uuid
from django.db import models
from django.core.validators import MinValueValidator
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Contribution(TenantAwareModel):
    """Cotisation d\'un membre lors d\'une seance."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        PAID = 'paid', 'Paye'
        PARTIAL = 'partial', 'Partiel'
        DEFAULTED = 'defaulted', 'Impaye'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey('cycles.Session', on_delete=models.CASCADE, related_name='contributions')
    membership = models.ForeignKey('members.Membership', on_delete=models.CASCADE, related_name='contributions')
    tontine_type = models.ForeignKey('tontines.TontineType', on_delete=models.CASCADE)

    num_shares = models.PositiveIntegerField(default=1)
    rate_per_share = models.DecimalField(max_digits=12, decimal_places=2)
    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    receipt_number = models.CharField(max_length=100, blank=True)

    recorded_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,related_name='contributions_recorded',
    )
    contribution_justification = models.FileField(upload_to='contribution_justifications/', null=True, blank=True)

    # ── Bordereau de réception (signature électronique) ────────────────
    receipt_signature = models.ImageField(
        upload_to='contributions/signatures/', null=True, blank=True,
    )
    receipt_signed_at = models.DateTimeField(null=True, blank=True)
    receipt_device_info = models.JSONField(default=dict, blank=True)
    receipt_hash = models.CharField(max_length=64, blank=True)
    receipt_pdf = models.FileField(upload_to='contributions/receipts/', null=True, blank=True)
    
    

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'contributions'
        unique_together = ['session', 'membership', 'tontine_type']
        indexes = [models.Index(fields=['association', 'session', 'status'])]
        ordering = ['-created_at']


class ContributionCorrectionRequest(TenantAwareModel):
    """
    Demande de correction d'une cotisation par la trésorière, soumise à
    double validation (Président + autre membre du bureau).

    Règles :
    - bloquée si la cotisation a déjà un bordereau signé (`receipt_pdf`)
    - le requérant ne peut pas être un des approbateurs
    - président = bureau position slug='president' OU membership.is_founder
    - autre approbateur = tout autre membre actif du bureau (≠ requérant, ≠ président)
    - 24h de TTL : au-delà, plus aucune action possible (expire automatiquement)
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        PRES_APPROVED = 'pres_approved', 'Validé par le Président'
        BUREAU_APPROVED = 'bureau_approved', 'Validé par un membre du Bureau'
        APPROVED = 'approved', 'Approuvé et appliqué'
        REJECTED = 'rejected', 'Rejeté'
        CANCELLED = 'cancelled', 'Annulé par le requérant'
        EXPIRED = 'expired', 'Expiré (24h dépassées)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contribution = models.ForeignKey(
        Contribution, on_delete=models.CASCADE, related_name='correction_requests',
    )
    requested_by = models.ForeignKey(
        'members.Membership', on_delete=models.PROTECT,
        related_name='correction_requests_made',
    )

    original_paid_amount = models.DecimalField(max_digits=14, decimal_places=2)
    new_paid_amount = models.DecimalField(max_digits=14, decimal_places=2)
    original_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20, blank=True)
    reason = models.TextField()

    president_approval = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='correction_requests_approved_pres',
    )
    president_approval_at = models.DateTimeField(null=True, blank=True)

    bureau_approval = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='correction_requests_approved_bureau',
    )
    bureau_approval_at = models.DateTimeField(null=True, blank=True)

    rejected_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='correction_requests_rejected',
    )
    rejection_reason = models.TextField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    applied_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(help_text="24h après création")

    reversal_transaction = models.ForeignKey(
        'finance.Transaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='correction_reversal_for',
    )
    new_transaction = models.ForeignKey(
        'finance.Transaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='correction_replacement_for',
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'contribution_correction_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['contribution', 'status']),
        ]


class Loan(TenantAwareModel):
    """Pret accorde a un membre."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        APPROVED = 'approved', 'Approuve'
        DISBURSED = 'disbursed', 'Decaisse'
        REPAYING = 'repaying', 'En remboursement'
        REPAID = 'repaid', 'Rembourse'
        DEFAULTED = 'defaulted', 'En defaut'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey('members.Membership', on_delete=models.CASCADE, related_name='loans')
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_due = models.DecimalField(max_digits=14, decimal_places=2)
    total_repaid = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    session_granted = models.ForeignKey(
        'cycles.Session', on_delete=models.SET_NULL, null=True, related_name='loans_granted',
    )
    due_date = models.DateField(null=True, blank=True)
    purpose = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    approved_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True, related_name='loans_approved',
    )
    guarantors = models.ManyToManyField('members.Membership', blank=True, related_name='guaranteed_loans')

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'loans'
        indexes = [
            models.Index(fields=['association', 'status']),
            models.Index(fields=['association', 'membership', 'status']),
        ]


class LoanRepayment(TenantAwareModel):
    """Remboursement d\'un pret."""
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='repayments')
    session = models.ForeignKey(
        'cycles.Session', on_delete=models.SET_NULL, null=True, related_name='loan_repayments',
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_at = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    # ── Bordereau de remboursement (signature électronique) ─────────────
    receipt_signature = models.ImageField(
        upload_to='loan_repayments/signatures/', null=True, blank=True,
    )
    receipt_signed_at = models.DateTimeField(null=True, blank=True)
    receipt_device_info = models.JSONField(default=dict, blank=True)
    receipt_hash = models.CharField(max_length=64, blank=True)
    receipt_pdf = models.FileField(upload_to='loan_repayments/receipts/', null=True, blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'loan_repayments'


class TreasuryAccount(TenantAwareModel):
    """Compte de tresorerie."""
    class AccountType(models.TextChoices):
        CASH = 'cash', 'Caisse'
        BANK = 'bank', 'Banque'
        MOBILE_MONEY = 'mobile_money', 'Mobile Money'
        OTHER = 'other', 'Autre'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=20, choices=AccountType.choices, default=AccountType.CASH)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'treasury_accounts'

    def __str__(self):
        return self.name


class Transaction(TenantAwareModel):
    """Journal de TOUTES les transactions financieres."""
    class TransactionType(models.TextChoices):
        CONTRIBUTION = 'contribution', 'Cotisation'
        LOAN_OUT = 'loan_out', 'Decaissement pret'
        LOAN_REPAYMENT = 'loan_repayment', 'Remboursement pret'
        SANCTION = 'sanction', 'Amende/Sanction'
        EXPENSE = 'expense', 'Depense'
        INCOME = 'income', 'Revenu divers'
        BENEFICIARY_PAYOUT = 'beneficiary_payout', 'Versement beneficiaire'
        ADJUSTMENT = 'adjustment', 'Ajustement'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(TreasuryAccount, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=30, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    is_debit = models.BooleanField(help_text="True=sortie, False=entree")
    balance_after = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.TextField(blank=True)
    reference = models.CharField(max_length=100, blank=True)

    session = models.ForeignKey('cycles.Session', on_delete=models.SET_NULL, null=True, blank=True)
    membership = models.ForeignKey('members.Membership', on_delete=models.SET_NULL, null=True, blank=True)
    recorded_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions_recorded',
    )

    distribute_to_members = models.BooleanField(
        default=False,
        help_text="Si True et type=expense : la dépense est répercutée sur les wallets des membres souscripteurs du cycle.",
    )

    # Fonds virtuel auquel appartient cette transaction (bucket).
    # Null = non affecté (frais admin globaux).
    tontine_type = models.ForeignKey(
        'tontines.TontineType', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='transactions',
        help_text="Type de cotisation (fonds virtuel) auquel appartient cette transaction.",
    )

    # ── Cotisations en nature ──
    # `amount` reste la valeur XAF équivalente (pour reporting + seuils abonnement).
    # `in_kind_quantity` et `in_kind_unit_label` capturent la quantité réelle
    # collectée/versée si la transaction concerne un bien en nature.
    in_kind_quantity = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="Quantité d'unités si transaction en nature (ex: 3 sacs). Null si cash.",
    )
    in_kind_unit_label = models.CharField(
        max_length=100, blank=True,
        help_text="Libellé de l'unité (snapshot du TontineType au moment de la transaction).",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'transaction_type', 'created_at']),
            models.Index(fields=['association', 'account', 'created_at']),
            models.Index(fields=['association', 'tontine_type', 'created_at']),
        ]
