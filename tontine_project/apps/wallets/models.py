import uuid
from decimal import Decimal
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Wallet(TenantAwareModel):
    """
    Portefeuille virtuel d'un membre. Agrège les WalletEntry pour offrir
    un solde synthétique. Le solde est virtuel : à la clôture du cycle,
    l'association règle ce qu'elle doit (positif) ou réclame (négatif).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.OneToOneField(
        'members.Membership', on_delete=models.CASCADE, related_name='wallet',
    )

    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total_credits = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total_debits = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    last_entry_at = models.DateTimeField(null=True, blank=True)

    is_frozen = models.BooleanField(
        default=False,
        help_text="Gelé après démission, plus aucune écriture acceptée.",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'wallets'
        indexes = [
            models.Index(fields=['association', 'balance']),
        ]

    def __str__(self):
        return f"Wallet {self.membership} : {self.balance}"


class WalletEntry(TenantAwareModel):
    """
    Écriture sur un wallet. Direction signée (credit/debit), source typée
    pour la traçabilité, regroupement par distribution_batch.
    """
    class Direction(models.TextChoices):
        CREDIT = 'credit', 'Crédit (+)'
        DEBIT = 'debit', 'Débit (−)'

    class Source(models.TextChoices):
        AUCTION_PREMIUM = 'auction_premium', "Prime d'enchère"
        LOAN_INTEREST = 'loan_interest', "Intérêt de prêt remboursé"
        SANCTION_PAYMENT = 'sanction_payment', "Sanction payée"
        CONTRIBUTION_DEFAULT = 'contribution_default', "Cotisation impayée"
        DEFAULT_COMPENSATION = 'default_compensation', "Compensation collective de défaut"
        EXPENSE = 'expense', "Dépense distribuée"
        MANUAL_ADJUSTMENT = 'manual_adjustment', "Ajustement manuel"
        MEMBERSHIP_FEE = 'membership_fee', "Frais d'adhésion (inscription/fond de membre)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='entries')

    direction = models.CharField(max_length=10, choices=Direction.choices)
    amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Toujours positif. Le signe est porté par direction.",
    )

    source_type = models.CharField(max_length=30, choices=Source.choices)
    source_id = models.UUIDField(
        null=True, blank=True,
        help_text="Référence (UUID) à l'objet source : AuctionBid, Sanction, "
                  "LoanRepayment, Contribution, Transaction. Pas de FK pour rester souple.",
    )

    session = models.ForeignKey(
        'cycles.Session', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wallet_entries',
    )
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wallet_entries',
    )

    distribution_batch = models.UUIDField(
        null=True, blank=True, db_index=True,
        help_text="Regroupe les WalletEntry issues d'une même distribution.",
    )
    total_distributed = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0'),
        help_text="Montant brut de la source avant division.",
    )
    members_count = models.PositiveIntegerField(default=1)
    per_member_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0'),
    )

    description = models.CharField(max_length=255, blank=True)
    balance_after = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'wallet_entries'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['association', 'source_type', '-created_at']),
            models.Index(fields=['session', 'source_type']),
            models.Index(fields=['distribution_batch']),
        ]

    @property
    def signed_amount(self):
        return self.amount if self.direction == self.Direction.CREDIT else -self.amount

    def __str__(self):
        sign = '+' if self.direction == self.Direction.CREDIT else '-'
        return f"{sign}{self.amount} {self.get_source_type_display()} → {self.wallet.membership}"
