import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager



class AcquisitionMethod(models.TextChoices):
    """
    Methode d'attribution du beneficiaire.
    Enum unique partagee entre CycleTontineConfig (niveau cycle)
    ET BeneficiaryPayout (niveau seance).
    """
    RANDOM = 'random', 'Tirage aleatoire'
    SEQUENTIAL = 'sequential', 'Tour de role'
    AUCTION = 'auction', 'Enchere (plus offrant)'
    VOTE = 'vote', 'Vote des membres'
    NEED_BASED = 'need_based', 'Selon le besoin (decision bureau)'
    MANUAL = 'manual', 'Attribution manuelle'


class Cycle(TenantAwareModel):
    """Cycle de vie de l\'association (souvent 1 an)."""
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Brouillon'
        ACTIVE = 'active', 'En cours'
        COMPLETED = 'completed', 'Termine'
        CANCELLED = 'cancelled', 'Annule'

    class Frequency(models.TextChoices):
        WEEKLY = 'weekly', 'Hebdomadaire'
        BIWEEKLY = 'biweekly', 'Bimensuel'
        MONTHLY = 'monthly', 'Mensuel'
        QUARTERLY = 'quarterly', 'Trimestriel'
        CUSTOM = 'custom', 'Personnalise'

    class RecurrenceKind(models.TextChoices):
        NONE = 'none', 'Aucun pattern'
        FIXED_DAY_OF_MONTH = 'fixed_day_of_month', 'Jour fixe du mois (ex: le 15)'
        NTH_WEEKDAY_OF_MONTH = 'nth_weekday', 'Nième jour de semaine du mois (ex: 3ᵉ samedi)'
        EVERY_WEEKDAY = 'every_weekday', 'Chaque semaine, un jour précis'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    session_frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.MONTHLY)
    default_session_day = models.PositiveSmallIntegerField(null=True, blank=True)
    default_session_time = models.TimeField(null=True, blank=True)
    default_session_location = models.CharField(
        max_length=255, blank=True,
        help_text="Adresse par défaut (souvent le siège social).",
    )

    # ── Pattern de récurrence pour auto-génération des séances ─────────
    recurrence_kind = models.CharField(
        max_length=30, choices=RecurrenceKind.choices,
        default=RecurrenceKind.NONE, blank=True,
        help_text="Type de pattern pour calculer les dates des séances.",
    )
    recurrence_nth = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Pour `nth_weekday` : 1=premier, 2=deuxième, ..., 5=dernier.",
    )
    recurrence_weekday = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Pour `nth_weekday` ou `every_weekday` : 0=lundi, ..., 6=dimanche.",
    )
    recurrence_day_of_month = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Pour `fixed_day_of_month` : 1-31.",
    )
    sessions_generated_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Horodatage de la dernière auto-génération de séances.",
    )

    tontine_types = models.ManyToManyField(
        'tontines.TontineType', through='CycleTontineConfig', related_name='cycles',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'cycles'
        ordering = ['-start_date']

    def __str__(self):
        return self.name
    
    
class CycleTontineConfig(TenantAwareModel):
    """
    Configuration d'un type de tontine pour un cycle.
    Definit la methode PAR DEFAUT pour tout le cycle.
    Chaque SessionPot herite de default_method automatiquement.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name='tontine_configs')
    tontine_type = models.ForeignKey('tontines.TontineType', on_delete=models.CASCADE)

    # Methode par defaut pour tout le cycle (enum partagee avec BeneficiaryPayout)
    default_method = models.CharField(
        max_length=20,
        choices=AcquisitionMethod.choices,
        default=AcquisitionMethod.RANDOM,
        help_text="Methode appliquee par defaut a chaque seance du cycle",
    )

    # Flexibilite : autoriser un changement ponctuel par seance
    allow_override = models.BooleanField(
        default=False,
        help_text="Permet au bureau de changer la methode pour une seance specifique",
    )
    allowed_overrides = models.JSONField(
        default=list, blank=True,
        help_text='Methodes autorisees en override. Ex: ["auction", "need_based"]',
    )

    auction_premium_destination = models.CharField(
        max_length=20,
        choices=[
            ('treasury', 'Caisse de réserve'),
            ('next_pot', 'Réinjecté dans les prochaines cagnettes'),
            ('split', 'Partagé entre caisse et cagnotte'),
        ],
        default='treasury',
        help_text="Où va la prime d'enchère du gagnant",
    )
    auction_premium_split_ratio = models.DecimalField(
        max_digits=3, decimal_places=2, default=0.5,
        help_text="Si split : ratio pour la cagnotte (0.5 = 50%)",
    )
    config = models.JSONField(default=dict, blank=True, help_text="""
        {
            "exclude_already_benefited": true,
            "allow_partial_claim": true,
            "min_claim_shares": 1,
            "max_beneficiaries_per_session": null,
            "allow_carry_over": true,
            "min_attendance_rate": 0.75,
            "grace_period_sessions": 2, 
            "reinject_auction_premium": false
        }
    """)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'cycle_tontine_configs'
        unique_together = ['cycle', 'tontine_type']

    def __str__(self):
        return f"{self.tontine_type.name} — {self.get_default_method_display()}"

    def get_effective_method(self, override_method=None):
        """
        Retourne la methode effective pour une seance.
        Valide l'override si demande.
        """
        if override_method and override_method != self.default_method:
            if not self.allow_override:
                raise ValueError(
                    f"L'override n'est pas autorise. "
                    f"Methode du cycle : {self.get_default_method_display()}"
                )
            if self.allowed_overrides and override_method not in self.allowed_overrides:
                allowed = ', '.join(self.allowed_overrides)
                raise ValueError(
                    f"Methode '{override_method}' non autorisee. "
                    f"Overrides permis : {allowed}"
                )
            return override_method
        return self.default_method


class Session(TenantAwareModel):
    """Seance/reunion d\'un cycle."""
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Programmee'
        IN_PROGRESS = 'in_progress', 'En cours'
        COMPLETED = 'completed', 'Terminee'
        CANCELLED = 'cancelled', 'Annulee'
        POSTPONED = 'postponed', 'Reportee'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name='sessions')
    session_number = models.PositiveIntegerField(null=True, blank=True)
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.CharField(
        max_length=255, blank=True,
        help_text="Adresse finale (vide = utiliser celle du cycle / siège social).",
    )
    host_member = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hosted_sessions',
        help_text=(
            "Membre qui héberge cette séance (typique pour les tontines "
            "tour-de-rôle/random chez le bénéficiaire). Optionnel."
        ),
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    minutes = models.TextField(blank=True, help_text="Proces-verbal")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'sessions'
        unique_together = ['cycle', 'session_number']
        ordering = ['date']

    def __str__(self):
        return f"Seance {self.session_number} - {self.date}"


class SessionReport(TenantAwareModel):
    """
    Rapport individuel de seance redige par un membre du bureau.

    Distinct du PV global (Session.minutes). Chaque membre du bureau
    (President, Tresorier, Secretaire, etc.) peut publier son propre
    rapport pour une seance donnee. Optionnel.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name='reports',
    )
    bureau_member = models.ForeignKey(
        'members.BureauMember', on_delete=models.CASCADE,
        related_name='session_reports',
    )
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'session_reports'
        unique_together = ['session', 'bureau_member']
        ordering = ['-created_at']

    def __str__(self):
        return f"Rapport {self.bureau_member} - Seance {self.session.session_number}"


class SessionReportAttachment(TenantAwareModel):
    """Piece jointe (PDF, image) attachee a un rapport de seance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        SessionReport, on_delete=models.CASCADE, related_name='attachments',
    )
    file = models.FileField(upload_to='session_reports/%Y/%m/')
    filename = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'session_report_attachments'
        ordering = ['-uploaded_at']


class SessionAttendance(TenantAwareModel):
    """Presence d\'un membre a une seance."""
    class AttendanceStatus(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'
        EXCUSED = 'excused', 'Excuse'
        LATE = 'late', 'En retard'
        REPRESENTED = 'represented', 'Represente'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='attendances')
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='attendances',
    )
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.ABSENT)
    represented_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='representations',
    )
    notes = models.TextField(blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'session_attendances'
        unique_together = ['session', 'membership']


class BeneficiarySchedule(TenantAwareModel):
    """Programmation des beneficiaires par session et type de tontine."""
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Programme'
        COMPLETED = 'completed', 'Boucle'
        SKIPPED = 'skipped', 'Saute'
        SWAPPED = 'swapped', 'Echange'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name='beneficiary_schedule')
    tontine_type = models.ForeignKey('tontines.TontineType', on_delete=models.CASCADE)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='beneficiaries')
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='beneficiary_slots',
    )
    order = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    total_received = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'beneficiary_schedule'
        unique_together = ['cycle', 'tontine_type', 'session']
        ordering = ['order']


class SessionPot(TenantAwareModel):
    """
        Cagnotte d'une session pour un type de tontine.
        Calcule et suit le montant total disponible pour distribution :
        total_available = collecte du jour + report de la session précédente

        Après distribution, le reliquat (remainder) est reporté
        automatiquement à la session suivante.

        UN SessionPot par (session, tontine_type).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        'Session', on_delete=models.CASCADE, related_name='pots',
    )
    tontine_type = models.ForeignKey(
        'tontines.TontineType', on_delete=models.CASCADE,
    )

    # Montants calculés
    total_collected = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Somme des cotisations effectivement payées cette session",
    )
    carry_over_in = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Report reçu de la session précédente",
    )
    auction_premium_in = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Prime d'enchère réinjectée (si config le prévoit)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total_available(self):
        """Cagnotte totale disponible = collecte + report + primes."""
        return self.total_collected + self.carry_over_in + self.auction_premium_in

    total_distributed = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Somme effectivement versée aux bénéficiaires",
    )

    remainder = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Reliquat à reporter à la session suivante",
    )

    # Lien avec le pot précédent pour traçabilité
    previous_pot = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='next_pot',
        help_text="Pot de la session précédente (source du carry_over_in)",
    )

    is_closed = models.BooleanField(
        default=False,
        help_text="True = distribution terminée, reliquat calculé",
    )

    # Methode effective (heritee de CycleTontineConfig ou overridee)
    effective_method = models.CharField(
        max_length=20, choices=AcquisitionMethod.choices,
        blank=True, default='',
        help_text="Methode utilisee pour cette seance (heritee ou overridee)",
    )
    is_method_overridden = models.BooleanField(
        default=False,
        help_text="True si la methode a ete changee par rapport a la config du cycle",
    )
    override_reason = models.TextField(
        blank=True,
        help_text="Justification si la methode a ete overridee",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'session_pots'
        unique_together = ['session', 'tontine_type']
        ordering = ['session__date']

    def __str__(self):
        return f"Pot {self.tontine_type.name} — Séance {self.session.session_number}"

    def close_pot(self):
        """
        Clôture le pot : calcule le reliquat et le reporte.
        Appelé par le service après la distribution.
        """
        self.remainder = self.total_available - self.total_distributed
        self.is_closed = True
        self.save(update_fields=['remainder', 'is_closed'])


class BeneficiaryPayout(TenantAwareModel):
    """
        Versement à un bénéficiaire lors d'une session.
        PEUT Y AVOIR PLUSIEURS payouts par session/tontine (c'est le changement clé).

        Un membre avec 3 noms peut choisir de prendre :
        - 3 noms (montant complet)
        - 2 noms (montant partiel, le reste reste dans le pot)
        - 1 nom (minimum)

        Le payout est lié au SessionPot, pas directement à la session.
    """
    class AcquisitionMethod(models.TextChoices):
        SCHEDULED = 'scheduled', 'Ordre programmé (tirage/tour de rôle)'
        AUCTION = 'auction', 'Enchère (plus offrant)'
        VOTE = 'vote', 'Vote des membres'
        NEED = 'need', 'Besoin (décision du bureau)'
        MANUAL = 'manual', 'Attribution manuelle'

    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente de versement'
        PAID = 'paid', 'Versé'
        CANCELLED = 'cancelled', 'Annulé'

    class PayoutMethod(models.TextChoices):
        CASH = 'cash', 'Espèces'
        MOBILE_MONEY = 'mobile_money', 'Mobile Money'
        BANK_TRANSFER = 'bank_transfer', 'Virement bancaire'
        CHECK = 'check', 'Chèque'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    pot = models.ForeignKey(
        SessionPot, on_delete=models.CASCADE, related_name='payouts',
    )
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='tontine_payouts',
    )

    guarantor = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='guaranteed_payouts',
    )

    guarantor_cni_number = models.CharField(
        max_length=100,null=True , blank=True, help_text="CNI du garant (si différent du membre)",
    )

    guarantor_signature = models.CharField(
        max_length=255,null=True ,blank=True, help_text="Signature du garant (peut être une URL vers une image ou une signature électronique)",
    )

    confirmation_receipt = models.CharField(
        max_length=255,null=True ,blank=True, help_text="Référence du reçu de paiement (numéro de transaction, etc.)"
    )

    received_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payouts_received_for_others',
        help_text="Membre ayant physiquement reçu l'argent (différent du titulaire si procuration).",
    )
    proxy_record = models.ForeignKey(
        'proxies.Proxy', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payouts',
        help_text="Procuration utilisée pour cette remise (le cas échéant).",
    )

    # Combien de "noms" le bénéficiaire prend
    shares_claimed = models.PositiveIntegerField(
        help_text="Nombre de noms que le bénéficiaire choisit de prendre",
    )
    shares_total = models.PositiveIntegerField(
        help_text="Nombre total de noms du membre (pour référence)",
    )

    # Montant
    amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Montant effectivement versé au bénéficiaire (en XAF équivalent si en nature).",
    )

    # ── Versement en nature ──────────────────────────────────────────
    # Pour les tontines `in_kind` : le bénéficiaire reçoit normalement en
    # nature (sacs, bouteilles…). Le bureau peut décider de convertir en
    # argent au dernier moment (was_converted_to_cash=True).
    is_in_kind = models.BooleanField(
        default=False,
        help_text="Versement en nature (héritée du TontineType).",
    )
    in_kind_quantity = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="Quantité versée en nature (ex: 10 sacs).",
    )
    in_kind_unit_label = models.CharField(
        max_length=100, blank=True,
        help_text="Snapshot du libellé d'unité au moment du versement.",
    )
    was_converted_to_cash = models.BooleanField(
        default=False,
        help_text="True si le versement initialement prévu en nature a été converti en argent.",
    )

    # Comment il a obtenu la tontine
    acquisition_method = models.CharField(
        max_length=20, choices=AcquisitionMethod.choices,
        default=AcquisitionMethod.SCHEDULED,
    )

    # Comment il a recevra le paiement
    payout_method = models.CharField(
        max_length=20, choices=PayoutMethod.choices,
        default=PayoutMethod.CASH,null=True
    )

    # Ordre de passage (si mode programmé)
    schedule_order = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Position dans l'ordre de passage du cycle",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # ── Bordereau de réception (signature électronique) ────────────────
    receipt_signature = models.ImageField(
        upload_to='payouts/signatures/', null=True, blank=True,
        help_text="Signature du bénéficiaire au moment du versement.",
    )
    receipt_signed_at = models.DateTimeField(null=True, blank=True)
    receipt_device_info = models.JSONField(
        default=dict, blank=True,
        help_text="IP, user-agent, plateforme au moment de la signature.",
    )
    receipt_hash = models.CharField(
        max_length=64, blank=True,
        help_text="SHA-256 du contenu du bordereau (intégrité).",
    )
    receipt_pdf = models.FileField(
        upload_to='payouts/receipts/', null=True, blank=True,
        help_text="Bordereau PDF signé et hashé.",
    )
    receipt_number = models.CharField(
        max_length=50, blank=True,
        help_text="Numéro séquentiel du bordereau dans l'association.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'beneficiary_payouts'
        ordering = ['pot__session__date', 'schedule_order']
        indexes = [
            models.Index(fields=['association', 'membership', 'status']),
            models.Index(fields=['receipt_hash']),
        ]

    def __str__(self):
        return (
            f"{self.membership.user.first_name} — "
            f"{self.shares_claimed}/{self.shares_total} noms — "
            f"{self.amount} XAF"
        ) 
    
    def save(self, *args, **kwargs):
        if not self.acquisition_method and self.pot_id:
            self.acquisition_method = self.pot.effective_method
        super().save(*args, **kwargs)

class AuctionBid(TenantAwareModel):
    """
    Enchère d'un membre pour obtenir la cagnotte.
    Le plus offrant remporte la tontine. Le montant de l'enchère (premium)
    peut aller dans la caisse de réserve ou être réinjecté dans les
    prochaines cagnottes selon la config de l'association.
    """
    class Status(models.TextChoices):
        ACTIVE = 'active', 'En cours'
        WON = 'won', 'Remportée'
        LOST = 'lost', 'Perdue'
        CANCELLED = 'cancelled', 'Annulée'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pot = models.ForeignKey(
        SessionPot, on_delete=models.CASCADE, related_name='bids',
    )
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='auction_bids',
    )

    bid_amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Montant de l'enchère proposée par le membre",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE,
    )

    # Si l'enchère est gagnée, référence au payout créé
    resulting_payout = models.OneToOneField(
        BeneficiaryPayout, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='from_auction',
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'auction_bids'
        ordering = ['-bid_amount']
        indexes = [
            models.Index(fields=['pot', 'status', '-bid_amount']),
        ]

    def __str__(self):
        return f"{self.membership.user.first_name} enchérit {self.bid_amount} XAF"