from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager
import uuid


class Document(TenantAwareModel):
    """Documents officiels versionnes (charte, statuts, RI, amendements)."""
    class DocType(models.TextChoices):
        CHARTER = 'charter', 'Charte'
        BYLAWS = 'bylaws', 'Statuts'
        INTERNAL_RULES = 'internal_rules', 'Reglement interieur'
        AMENDMENT = 'amendment', 'Amendement'
        OTHER = 'other', 'Autre'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doc_type = models.CharField(max_length=30, choices=DocType.choices)
    title = models.CharField(max_length=255)
    content = models.TextField(help_text="Contenu en Markdown ou HTML")
    version = models.CharField(max_length=20, default='1.0')
    is_active = models.BooleanField(default=True)
    effective_date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to='governance/documents/', blank=True)
    approved_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'governance_documents'
        ordering = ['-effective_date', '-version']

    def __str__(self):
        return f"{self.title} (v{self.version})"


class Election(TenantAwareModel):
    """Election pour renouveler le bureau."""
    class Method(models.TextChoices):
        VOTE_SECRET = 'secret', 'Vote a bulletin secret'
        VOTE_OPEN = 'open', 'Vote a main levee'
        CONSENSUS = 'consensus', 'Consensus'
        DESIGNATION = 'designation', 'Designation par les statuts'
        OTHER = 'other', 'Autre'

    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planifiee'
        IN_PROGRESS = 'in_progress', 'En cours'
        COMPLETED = 'completed', 'Terminee'
        CANCELLED = 'cancelled', 'Annulee'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cycle = models.ForeignKey('cycles.Cycle', on_delete=models.CASCADE, related_name='elections')
    session = models.ForeignKey('cycles.Session', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255)
    method = models.CharField(max_length=30, choices=Method.choices, default=Method.VOTE_SECRET)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    date = models.DateField()
    notes = models.TextField(blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'elections'


class ElectionCandidate(TenantAwareModel):
    """Candidat a un poste lors d\'une election."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name='candidates')
    membership = models.ForeignKey('members.Membership', on_delete=models.CASCADE, related_name='candidatures')
    position = models.ForeignKey('members.BureauPosition', on_delete=models.CASCADE)
    votes_count = models.PositiveIntegerField(default=0)
    is_elected = models.BooleanField(default=False)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'election_candidates'
        unique_together = ['election', 'membership', 'position']


class Vote(TenantAwareModel):
    """Vote individuel. voter=NULL si bulletin secret."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name='votes')
    candidate = models.ForeignKey(ElectionCandidate, on_delete=models.CASCADE, related_name='votes')
    voter = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='votes_cast',
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'votes'


class Announcement(TenantAwareModel):
    """
    Annonce diffusée aux membres d'une association.
    Le bureau peut publier des annonces (réunion, info, urgence, etc.).
    """
    class Priority(models.TextChoices):
        LOW = 'low', 'Information'
        NORMAL = 'normal', 'Normal'
        HIGH = 'high', 'Important'
        URGENT = 'urgent', 'Urgent'

    class Audience(models.TextChoices):
        ALL = 'all', 'Tous les membres'
        BUREAU = 'bureau', 'Bureau uniquement'
        ACTIVE = 'active', 'Membres actifs uniquement'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content = models.TextField(help_text="Contenu en Markdown ou HTML")
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.NORMAL,
    )
    audience = models.CharField(
        max_length=20, choices=Audience.choices, default=Audience.ALL,
    )
    is_pinned = models.BooleanField(
        default=False, help_text="Épingle l'annonce en haut de la liste.",
    )
    is_published = models.BooleanField(default=True)

    starts_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date de début de publication (vide = immédiat).",
    )
    ends_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date d'expiration (vide = pas d'expiration).",
    )

    attachment = models.FileField(
        upload_to='governance/announcements/', null=True, blank=True,
    )

    author = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='announcements_authored',
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'announcements'
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['association', 'is_published', '-created_at']),
            models.Index(fields=['association', 'priority']),
        ]

    def __str__(self):
        return self.title


class Poll(TenantAwareModel):
    """
    Sondage / vote électronique avec choix radio (single) ou checklist (multi).
    Différent d'une `Election` qui sert spécifiquement à élire le bureau ;
    `Poll` couvre tous les autres votes (date prochaine réunion, choix de
    fournisseur, validation d'un point de l'ordre du jour, etc.).
    """
    class Kind(models.TextChoices):
        SINGLE = 'single_choice', 'Un seul choix (radio)'
        MULTI = 'multi_choice', 'Plusieurs choix (checklist)'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Brouillon'
        OPEN = 'open', 'Ouvert au vote'
        CLOSED = 'closed', 'Clôturé'
        CANCELLED = 'cancelled', 'Annulé'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    question = models.TextField(help_text="Question posée aux membres.")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SINGLE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    starts_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Début de la période de vote (vide = ouvert dès status=open).",
    )
    ends_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Fin de la période de vote (vide = ouvert jusqu'à clôture manuelle).",
    )

    is_anonymous = models.BooleanField(
        default=False,
        help_text="Si True, l'identité du votant n'est pas stockée (voter=NULL).",
    )
    allow_change_vote = models.BooleanField(
        default=False,
        help_text="Si True, le membre peut modifier son vote tant que le sondage est ouvert.",
    )
    max_choices = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Pour kind=multi_choice : nombre max d'options sélectionnables (vide = pas de limite).",
    )
    results_visible_before_close = models.BooleanField(
        default=True,
        help_text="Si False, les résultats ne sont visibles qu'après clôture.",
    )

    created_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='polls_created',
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'polls'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'status', '-created_at']),
        ]

    def __str__(self):
        return self.title


class PollOption(TenantAwareModel):
    """Une option proposée au vote dans un Poll."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    label = models.CharField(max_length=255)
    display_order = models.PositiveSmallIntegerField(default=0)
    votes_count = models.PositiveIntegerField(default=0)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'poll_options'
        ordering = ['display_order', 'created_at']


class PollVote(TenantAwareModel):
    """Vote individuel sur une option d'un Poll. voter=NULL si is_anonymous."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes_cast')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes_cast')
    voter = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='poll_votes_cast',
    )
    # Garantit l'anti-doublon même pour les votes anonymes : on hash le voter+poll
    # côté service ; ici on stocke un voter_fingerprint pour les sondages anonymes.
    voter_fingerprint = models.CharField(
        max_length=64, blank=True,
        help_text="SHA-256(voter.id + poll.id) — utilisé en sondage anonyme pour éviter les doublons.",
    )

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'poll_votes'
        indexes = [
            models.Index(fields=['poll', 'voter']),
            models.Index(fields=['poll', 'voter_fingerprint']),
        ]
        constraints = [
            # Un membre ne peut pas voter 2 fois pour la même option dans
            # un sondage NON-anonyme (le service interdit aussi 2 votes globaux
            # pour single_choice).
            models.UniqueConstraint(
                fields=['poll', 'option', 'voter'],
                condition=models.Q(voter__isnull=False),
                name='unique_vote_per_option_per_member',
            ),
        ]


class AnnouncementReadStatus(TenantAwareModel):
    """Marque qu'un membre a lu une annonce."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name='read_statuses',
    )
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='announcements_read',
    )
    read_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'announcement_read_status'
        unique_together = ['announcement', 'membership']
