import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from common.models import TimeStampedModel


class Plan(TimeStampedModel):
    """
    Plan d'abonnement GLOBAL (defini par l'admin plateforme).

    Toutes les fonctionnalites sont accessibles dans tous les plans.
    Les plans differencient :
      - le nombre maximum de membres
      - le montant maximum de cagnotte mensuelle
      - le prix
    """
    UNLIMITED = 0

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=50)
    description = models.TextField(blank=True)

    price_monthly = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=5, default='XAF')

    max_members = models.PositiveIntegerField(
        default=15, help_text="0 = illimite",
    )
    max_monthly_cagnotte = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Cagnotte mensuelle maximale autorisee (0 = illimite).",
    )

    trial_days = models.PositiveIntegerField(default=90)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'plans'
        ordering = ['display_order', 'price_monthly']

    def __str__(self):
        return f"{self.name} ({self.price_monthly} {self.currency}/mois)"

    @property
    def is_unlimited_members(self):
        return self.max_members == self.UNLIMITED

    @property
    def is_unlimited_cagnotte(self):
        return self.max_monthly_cagnotte == self.UNLIMITED


class Subscription(TimeStampedModel):
    """Abonnement d\'une association. Relation 1:1 avec Association."""
    class Status(models.TextChoices):
        TRIALING = 'trialing', "Periode d\'essai"
        ACTIVE = 'active', 'Actif'
        PAST_DUE = 'past_due', 'Paiement en retard'
        CANCELLED = 'cancelled', 'Annule'
        EXPIRED = 'expired', 'Expire'
        SUSPENDED = 'suspended', 'Suspendu'

    class BillingCycle(models.TextChoices):
        MONTHLY = 'monthly', 'Mensuel'
        YEARLY = 'yearly', 'Annuel'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    association = models.OneToOneField(
        'core.Association', on_delete=models.CASCADE, related_name='subscription',
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    billing_cycle = models.CharField(max_length=20, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)

    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    auto_renew = models.BooleanField(default=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    payment_provider = models.CharField(max_length=50, blank=True)
    payment_provider_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'subscriptions'
        indexes = [models.Index(fields=['status']), models.Index(fields=['trial_end'])]

    def __str__(self):
        return f"{self.association.name} - {self.plan.name} ({self.status})"

    @property
    def is_usable(self):
        now = timezone.now()
        if self.status == self.Status.TRIALING:
            return self.trial_end and now <= self.trial_end
        if self.status == self.Status.ACTIVE:
            return True
        if self.status == self.Status.PAST_DUE and self.current_period_end:
            return now <= self.current_period_end + timedelta(days=7)
        return False

    def check_member_limit(self):
        if self.plan.is_unlimited_members:
            return True
        count = self.association.membership_set.filter(is_active=True).count()
        return count < self.plan.max_members

    def check_cagnotte_limit(self, monthly_amount):
        """
        Verifie qu'un montant mensuel ne depasse pas la limite du plan.
        N'est PAS encore appliquee dans le code metier (preparation).
        """
        if self.plan.is_unlimited_cagnotte:
            return True
        return monthly_amount <= self.plan.max_monthly_cagnotte


class Payment(TimeStampedModel):
    """Historique des paiements d\'abonnement."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        COMPLETED = 'completed', 'Complete'
        FAILED = 'failed', 'Echoue'
        REFUNDED = 'refunded', 'Rembourse'

    class PaymentMethod(models.TextChoices):
        MOBILE_MONEY = 'mobile_money', 'Mobile Money (MTN/Orange)'
        CARD = 'card', 'Carte bancaire'
        BANK_TRANSFER = 'bank_transfer', 'Virement bancaire'
        CASH = 'cash', 'Especes'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=5, default='XAF')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.MOBILE_MONEY)
    provider_reference = models.CharField(max_length=255, blank=True)
    provider_data = models.JSONField(default=dict, blank=True)
    description = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
