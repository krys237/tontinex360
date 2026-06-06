import uuid
from django.db import models
from django.core.validators import MinValueValidator
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class TontineType(TenantAwareModel):
    """
    Type de tontine défini par l\'association.
    Ex: "Tontine principale", "Banque scolaire", "Épargne solidaire".

    Mode de cotisation (`contribution_kind`) :
    - `cash`    : cotisation en argent (XAF, €...). `fixed_rate` = montant par part.
    - `in_kind` : cotisation en nature (sacs de riz, bouteilles d'huile...).
                  `fixed_rate` = quantité d'unités par part.
                  `in_kind_unit_label` décrit l'unité (ex: "Sac de riz 25kg").
                  `in_kind_unit_value` donne la valeur XAF de référence (rapports,
                  seuils d'abonnement).
    """
    class RateMode(models.TextChoices):
        FIXED = 'fixed', 'Taux unique (fixe)'
        RANGE = 'range', 'Taux variable (min/max)'
        FREE = 'free', 'Montant libre'

    class ContributionKind(models.TextChoices):
        CASH = 'cash', 'En argent'
        IN_KIND = 'in_kind', 'En nature'

    class PayoutPattern(models.TextChoices):
        """
        Définit COMMENT les fonds collectés sont restitués aux membres :

        - rotating          : tontine classique. Un bénéficiaire par séance
                              (méthode = `default_acquisition_method`).
        - individual_savings: banque scolaire / épargne individuelle.
                              Chaque membre cotise (souvent en mode libre),
                              et en fin de cycle récupère SON cumul personnel.
        - collective_savings: caisse commune. Pas de bénéficiaire désigné,
                              les fonds restent à la trésorerie / sont
                              redistribués à parts égales en fin de cycle.
        """
        ROTATING = 'rotating', 'Tontine rotative (1 bénéficiaire / séance)'
        INDIVIDUAL_SAVINGS = 'individual_savings', 'Épargne individuelle (banque scolaire)'
        COLLECTIVE_SAVINGS = 'collective_savings', 'Caisse commune (trésorerie)'

    class DefaultAcquisitionMethod(models.TextChoices):
        """Méthode d'attribution par défaut quand `payout_pattern=rotating`."""
        RANDOM = 'random', 'Tirage aléatoire'
        SEQUENTIAL = 'sequential', 'Tour de rôle'
        AUCTION = 'auction', 'Enchère (plus offrant)'
        VOTE = 'vote', 'Vote des membres'
        NEED_BASED = 'need_based', 'Selon le besoin (décision bureau)'
        MANUAL = 'manual', 'Attribution manuelle'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)

    contribution_kind = models.CharField(
        max_length=20, choices=ContributionKind.choices,
        default=ContributionKind.CASH,
        help_text="Argent ou bien en nature.",
    )
    in_kind_unit_label = models.CharField(
        max_length=100, blank=True,
        help_text="Étiquette de l'unité (ex: 'Sac de riz 25kg'). Requis si contribution_kind='in_kind'.",
    )
    in_kind_unit_value = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Valeur XAF de référence d'une unité (pour rapports + seuils d'abonnement).",
    )

    rate_mode = models.CharField(max_length=20, choices=RateMode.choices, default=RateMode.RANGE)
    fixed_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    min_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=5, default='XAF')

    allows_multiple_shares = models.BooleanField(default=True)
    max_shares_per_member = models.PositiveIntegerField(default=5)
    share_unit_name = models.CharField(max_length=50, default='nom',
        help_text="Appellation locale: nom, bouche, main...")

    has_beneficiary = models.BooleanField(
        default=True,
        help_text=(
            "Conservé pour compatibilité. Dérivé de `payout_pattern` : "
            "True si rotating, False sinon."
        ),
    )

    # ── Mode de restitution des fonds (essentiel pour banque scolaire) ──
    payout_pattern = models.CharField(
        max_length=30,
        choices=PayoutPattern.choices,
        default=PayoutPattern.ROTATING,
        help_text=(
            "Comment les fonds collectés sont restitués : rotation (1 "
            "bénéficiaire/séance), épargne individuelle (chacun récupère son "
            "cumul en fin de cycle) ou caisse commune."
        ),
    )

    # ── Méthode d'attribution PAR DÉFAUT pour les tontines rotatives ────
    default_acquisition_method = models.CharField(
        max_length=20,
        choices=DefaultAcquisitionMethod.choices,
        default=DefaultAcquisitionMethod.RANDOM,
        help_text=(
            "Méthode d'attribution du bénéficiaire utilisée par défaut quand "
            "on crée un cycle pour cette tontine. Le bureau peut toujours "
            "l'overrider au niveau du cycle ou de la séance."
        ),
    )

    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    # Caisse physique par défaut où sont versés les flux de cette cotisation.
    # Optionnel : si vide, la caisse principale de l'association est utilisée.
    default_account = models.ForeignKey(
        'finance.TreasuryAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='default_for_tontine_types',
        help_text="Caisse physique par défaut pour les flux de cette cotisation.",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'tontine_types'
        unique_together = ['association', 'slug']
        ordering = ['display_order']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Garde `has_beneficiary` cohérent avec `payout_pattern` pour la
        # compatibilité avec l'ancien code qui lit ce flag.
        self.has_beneficiary = self.payout_pattern == self.PayoutPattern.ROTATING
        super().save(*args, **kwargs)


class MemberSubscription(TenantAwareModel):
    """
    Souscription d\'un membre a un type de tontine pour un cycle.
    Ex: "J\'ai 2 noms a 2000 XAF" -> num_shares=2, rate_per_share=2000
    """
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='subscriptions',
    )
    tontine_type = models.ForeignKey(
        TontineType, on_delete=models.CASCADE, related_name='subscriptions',
    )
    cycle = models.ForeignKey(
        'cycles.Cycle', on_delete=models.CASCADE, related_name='subscriptions',
    )

    num_shares = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    rate_per_share = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def amount_per_session(self):
        return self.num_shares * self.rate_per_share

    is_active = models.BooleanField(default=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'member_subscriptions'
        unique_together = ['membership', 'tontine_type', 'cycle']
