# Ajouts Architecture — Onboarding Invité, Notifications & Chat

## Nouvelles Apps

```
apps/
├── ...apps existantes...
├── notifications/         # NOUVEAU — Notifications multi-canal
└── chat/                  # NOUVEAU — Messagerie interne
```

**Total modèles : 31 → 35** (+4 nouveaux : Notification, Conversation, ConversationMember, Message)

---

## 1. Flux d'Onboarding Invité — Vue API Mise à Jour

### Le problème

L'invité reçoit un lien `app.com/invite/<token>`. Deux cas :
- **Cas A** : Il n'a pas de compte → il doit s'inscrire (nom, téléphone, mot de passe)
- **Cas B** : Il a déjà un compte → il se connecte et le token est automatiquement consommé

### Endpoint de vérification du token (côté frontend)

```python
# apps/invitations/views.py — AJOUTER cette vue

class CheckInvitationView(APIView):
    """
    Le frontend appelle cet endpoint quand l'invité clique sur le lien.
    Retourne les infos de l'invitation + si un compte existe déjà.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        from apps.invitations.models import Invitation
        from apps.core.models import User

        try:
            invitation = Invitation.all_objects.get(token=token)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invitation introuvable.'}, status=404)

        if not invitation.is_valid:
            return Response({
                'error': 'Invitation expirée ou déjà utilisée.',
                'status': invitation.status,
            }, status=410)

        # Vérifier si un compte existe déjà avec cet email ou téléphone
        existing_user = None
        if invitation.email:
            existing_user = User.objects.filter(email=invitation.email).first()
        if not existing_user and invitation.phone:
            existing_user = User.objects.filter(telephone=invitation.phone).first()

        return Response({
            'invitation': {
                'token': invitation.token,
                'association_name': invitation.association.name,
                'association_logo': invitation.association.logo.url if invitation.association.logo else None,
                'invited_by': f"{invitation.invited_by.user.first_name} {invitation.invited_by.user.last_name}",
                'role_name': invitation.role.name if invitation.role else 'Membre',
                'message': invitation.message,
                'expires_at': invitation.expires_at,
            },
            'has_existing_account': existing_user is not None,
            'existing_telephone': existing_user.telephone if existing_user else None,
        })
```

### Inscription + acceptation en une étape

```python
# apps/invitations/views.py — AJOUTER cette vue

class RegisterAndAcceptInvitationView(APIView):
    """
    Pour les invités qui n'ont PAS de compte.
    Crée le compte + accepte l'invitation en une seule requête.
    Retourne JWT + redirection vers le dashboard.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from apps.core.serializers import UserRegistrationSerializer
        from apps.invitations.services import InvitationService
        from rest_framework_simplejwt.tokens import RefreshToken

        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token requis.'}, status=400)

        # 1. Créer le compte
        user_serializer = UserRegistrationSerializer(data={
            'telephone': request.data.get('telephone'),
            'username': request.data.get('telephone'),  # Fallback
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
            'email': request.data.get('email', ''),
            'password': request.data.get('password'),
            'password_confirm': request.data.get('password_confirm'),
        })
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        # 2. Accepter l'invitation
        try:
            invitation, membership = InvitationService.accept_invitation(
                token=token, user=user,
            )
        except (ValueError, Exception) as e:
            # Rollback: supprimer le user créé
            user.delete()
            return Response({'error': str(e)}, status=400)

        # 3. Générer JWT
        refresh = RefreshToken.for_user(user)

        # 4. Notifier l'inviteur
        from apps.notifications.services import NotificationService
        NotificationService.notify(
            association=invitation.association,
            recipient=invitation.invited_by,
            notification_type='member_joined',
            title='Nouveau membre',
            body=f"{user.first_name} {user.last_name} a rejoint l'association.",
            data={'membership_id': str(membership.id)},
        )

        return Response({
            'user': {
                'id': str(user.id),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'telephone': user.telephone,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'association': {
                'slug': invitation.association.slug,
                'name': invitation.association.name,
            },
            'redirect_to': f'/dashboard/{invitation.association.slug}/',
        }, status=201)
```

### Login + acceptation pour les comptes existants

```python
# apps/invitations/views.py — AJOUTER cette vue

class LoginAndAcceptInvitationView(APIView):
    """
    Pour les invités qui ONT DÉJÀ un compte.
    Se connecte + accepte l'invitation.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        from apps.invitations.services import InvitationService
        from rest_framework_simplejwt.tokens import RefreshToken

        token = request.data.get('token')
        telephone = request.data.get('telephone')
        password = request.data.get('password')

        if not all([token, telephone, password]):
            return Response({'error': 'Token, téléphone et mot de passe requis.'}, status=400)

        # 1. Authentifier
        user = authenticate(request=request, telephone=telephone, password=password)
        if not user:
            return Response({'error': 'Identifiants invalides.'}, status=401)

        # 2. Accepter l'invitation
        try:
            invitation, membership = InvitationService.accept_invitation(
                token=token, user=user,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

        # 3. JWT
        refresh = RefreshToken.for_user(user)

        # 4. Notifier
        from apps.notifications.services import NotificationService
        NotificationService.notify(
            association=invitation.association,
            recipient=invitation.invited_by,
            notification_type='member_joined',
            title='Nouveau membre',
            body=f"{user.first_name} {user.last_name} a rejoint l'association.",
        )

        return Response({
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'association': {
                'slug': invitation.association.slug,
                'name': invitation.association.name,
            },
            'redirect_to': f'/dashboard/{invitation.association.slug}/',
        })
```

### URLs mises à jour

```python
# apps/invitations/urls.py — REMPLACER

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.invitations.views import (
    InvitationViewSet, SendInvitationView, AcceptInvitationView,
    CheckInvitationView, RegisterAndAcceptInvitationView,
    LoginAndAcceptInvitationView,
)

router = DefaultRouter()
router.register('list', InvitationViewSet, basename='invitation')

urlpatterns = [
    path('', include(router.urls)),
    path('send/', SendInvitationView.as_view(), name='send-invitation'),
    path('accept/', AcceptInvitationView.as_view(), name='accept-invitation'),

    # Onboarding invité
    path('check/<str:token>/', CheckInvitationView.as_view(), name='check-invitation'),
    path('register-accept/', RegisterAndAcceptInvitationView.as_view(), name='register-accept'),
    path('login-accept/', LoginAndAcceptInvitationView.as_view(), name='login-accept'),
]
```

### Flux côté Frontend (résumé)

```
1. Invité clique sur le lien → GET /api/invitations/check/<token>/
2. Le frontend reçoit :
   - has_existing_account: true/false
   - Infos de l'association + inviteur

3a. SI pas de compte → Afficher formulaire inscription
    → POST /api/invitations/register-accept/
      { token, telephone, first_name, last_name, password, password_confirm }
    → Reçoit JWT + redirect_to

3b. SI compte existant → Afficher formulaire login
    → POST /api/invitations/login-accept/
      { token, telephone, password }
    → Reçoit JWT + redirect_to

4. Frontend stocke le JWT, redirige vers le dashboard
```

---

## 2. App `notifications` — Notifications Multi-Canal

```python
# apps/notifications/models.py
import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Notification(TenantAwareModel):
    """
    Notification envoyée à un membre.
    Peut être in-app, email, SMS ou WhatsApp.
    """
    class NotificationType(models.TextChoices):
        # Membres
        MEMBER_JOINED = 'member_joined', 'Nouveau membre'
        MEMBER_LEFT = 'member_left', 'Membre parti'
        ROLE_ASSIGNED = 'role_assigned', 'Rôle attribué'
        ROLE_REMOVED = 'role_removed', 'Rôle retiré'

        # Sessions
        SESSION_REMINDER = 'session_reminder', 'Rappel de séance'
        SESSION_CREATED = 'session_created', 'Nouvelle séance'
        SESSION_CANCELLED = 'session_cancelled', 'Séance annulée'

        # Tontines
        BENEFICIARY_SELECTED = 'beneficiary_selected', 'Bénéficiaire désigné'
        CONTRIBUTION_DUE = 'contribution_due', 'Cotisation due'
        CONTRIBUTION_RECEIVED = 'contribution_received', 'Cotisation reçue'

        # Finance
        LOAN_APPROVED = 'loan_approved', 'Prêt approuvé'
        LOAN_REJECTED = 'loan_rejected', 'Prêt refusé'
        LOAN_DUE = 'loan_due', 'Remboursement dû'
        LOAN_OVERDUE = 'loan_overdue', 'Prêt en retard'

        # Sanctions
        SANCTION_APPLIED = 'sanction_applied', 'Sanction appliquée'
        SANCTION_WAIVED = 'sanction_waived', 'Sanction graciée'

        # Governance
        ELECTION_STARTED = 'election_started', 'Élection ouverte'
        ELECTION_RESULT = 'election_result', 'Résultat élection'
        DOCUMENT_PUBLISHED = 'document_published', 'Document publié'

        # Events
        EVENT_CREATED = 'event_created', 'Nouvel événement'
        EVENT_REMINDER = 'event_reminder', 'Rappel événement'

        # Chat
        NEW_MESSAGE = 'new_message', 'Nouveau message'

        # Subscription
        TRIAL_EXPIRING = 'trial_expiring', 'Trial expire bientôt'
        SUBSCRIPTION_EXPIRED = 'subscription_expired', 'Abonnement expiré'

        # Général
        CUSTOM = 'custom', 'Personnalisé'

    class Channel(models.TextChoices):
        IN_APP = 'in_app', 'In-app'
        EMAIL = 'email', 'Email'
        SMS = 'sms', 'SMS'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        PUSH = 'push', 'Push notification'

    class DeliveryStatus(models.TextChoices):
        PENDING = 'pending', 'En attente'
        SENT = 'sent', 'Envoyé'
        DELIVERED = 'delivered', 'Délivré'
        FAILED = 'failed', 'Échoué'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Destinataire
    recipient = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE,
        related_name='notifications',
    )

    # Contenu
    notification_type = models.CharField(
        max_length=30, choices=NotificationType.choices,
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)

    # Données structurées (pour le frontend : liens, IDs, etc.)
    data = models.JSONField(default=dict, blank=True, help_text="""
        {
            "session_id": "uuid",
            "link": "/sessions/uuid",
            "amount": 5000
        }
    """)

    # Canal et statut de livraison
    channel = models.CharField(
        max_length=20, choices=Channel.choices, default=Channel.IN_APP,
    )
    delivery_status = models.CharField(
        max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING,
    )
    sent_at = models.DateTimeField(null=True, blank=True)

    # Lecture
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['association', 'recipient', 'is_read']),
            models.Index(fields=['association', 'notification_type']),
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"{self.notification_type} → {self.recipient}"


class NotificationPreference(TenantAwareModel):
    """
    Préférences de notification par membre.
    Chaque membre peut choisir quels types de notifs il reçoit et par quel canal.
    """
    membership = models.OneToOneField(
        'members.Membership', on_delete=models.CASCADE,
        related_name='notification_preferences',
    )

    # Canaux activés globalement
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    whatsapp_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)

    # Types désactivés (tout est activé par défaut)
    muted_types = models.JSONField(default=list, blank=True, help_text="""
        Types de notification désactivés.
        Ex: ["session_reminder", "new_message"]
    """)

    # Heures de silence (pas de notifs entre ces heures)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'notification_preferences'
```

### Service de Notifications

```python
# apps/notifications/services.py
from django.utils import timezone


class NotificationService:
    """
    Service central pour créer et dispatcher les notifications.
    Toute notification passe par ici — jamais de création directe.
    """

    @classmethod
    def notify(cls, association, recipient, notification_type, title,
               body='', data=None, channels=None):
        """
        Crée et dispatch une notification.

        Args:
            association: Association (tenant)
            recipient: Membership du destinataire
            notification_type: Type de notification
            title: Titre court
            body: Corps du message
            data: Données JSON additionnelles
            channels: Liste de canaux (défaut: selon préférences du membre)
        """
        from apps.notifications.models import Notification, NotificationPreference

        # Vérifier les préférences du destinataire
        prefs = NotificationPreference.all_objects.filter(
            membership=recipient
        ).first()

        if prefs and notification_type in prefs.muted_types:
            return None  # Notification masquée par le membre

        # Canaux à utiliser
        if channels is None:
            channels = cls._resolve_channels(prefs, notification_type)

        notifications = []
        for channel in channels:
            notif = Notification.objects.create(
                association=association,
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                body=body,
                data=data or {},
                channel=channel,
            )
            notifications.append(notif)

            # Dispatcher selon le canal
            cls._dispatch(notif)

        return notifications

    @classmethod
    def notify_all_members(cls, association, notification_type, title,
                           body='', data=None, exclude=None):
        """Notifie tous les membres actifs d'une association."""
        from apps.members.models import Membership

        members = Membership.all_objects.filter(
            association=association, is_active=True,
        )
        if exclude:
            members = members.exclude(id__in=[m.id for m in exclude])

        for member in members:
            cls.notify(
                association=association,
                recipient=member,
                notification_type=notification_type,
                title=title,
                body=body,
                data=data,
            )

    @classmethod
    def notify_bureau(cls, association, notification_type, title,
                      body='', data=None):
        """Notifie uniquement les membres du bureau actif."""
        from apps.members.models import BureauMember

        bureau = BureauMember.all_objects.filter(
            association=association, is_active=True,
        ).select_related('membership')

        for bm in bureau:
            cls.notify(
                association=association,
                recipient=bm.membership,
                notification_type=notification_type,
                title=title,
                body=body,
                data=data,
            )

    @classmethod
    def mark_as_read(cls, notification_ids, membership):
        """Marque des notifications comme lues."""
        from apps.notifications.models import Notification
        Notification.all_objects.filter(
            id__in=notification_ids,
            recipient=membership,
        ).update(is_read=True, read_at=timezone.now())

    @classmethod
    def mark_all_as_read(cls, membership):
        """Marque toutes les notifications d'un membre comme lues."""
        from apps.notifications.models import Notification
        Notification.all_objects.filter(
            recipient=membership, is_read=False,
        ).update(is_read=True, read_at=timezone.now())

    @staticmethod
    def _resolve_channels(prefs, notification_type):
        """Détermine les canaux selon les préférences."""
        channels = ['in_app']  # Toujours in-app

        if not prefs:
            return channels

        # Ajouter les canaux activés
        if prefs.whatsapp_enabled:
            channels.append('whatsapp')
        elif prefs.sms_enabled:
            channels.append('sms')

        if prefs.email_enabled:
            channels.append('email')

        return channels

    @staticmethod
    def _dispatch(notification):
        """
        Dispatch la notification vers le canal approprié.
        En production, utilisera Celery pour l'envoi async.
        """
        if notification.channel == 'in_app':
            # Rien à faire — visible via l'API
            notification.delivery_status = 'delivered'
            notification.sent_at = timezone.now()
            notification.save(update_fields=['delivery_status', 'sent_at'])

        elif notification.channel == 'whatsapp':
            # TODO: Intégrer Twilio WhatsApp Business API
            # ou un service local (ex: WAAPI, Gupshup)
            pass

        elif notification.channel == 'sms':
            # TODO: Intégrer un provider SMS (Twilio, Nexmo, local)
            pass

        elif notification.channel == 'email':
            # TODO: Django send_mail ou service email (Mailgun, SES)
            pass

        elif notification.channel == 'push':
            # TODO: Firebase Cloud Messaging (FCM)
            pass
```

---

## 3. App `chat` — Messagerie Interne

```python
# apps/chat/models.py
import uuid
from django.db import models
from common.models import TenantAwareModel
from common.managers import TenantAwareManager


class Conversation(TenantAwareModel):
    """
    Conversation entre membres d'une association.
    Peut être : privée (2 membres), groupe, ou associée à un contexte.
    """
    class ConversationType(models.TextChoices):
        PRIVATE = 'private', 'Privée (1 à 1)'
        GROUP = 'group', 'Groupe'
        BUREAU = 'bureau', 'Bureau'
        SESSION = 'session', 'Liée à une séance'
        GENERAL = 'general', 'Général (toute l\'asso)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True, help_text=(
        "Nom du groupe. Vide pour les conversations privées."
    ))
    conv_type = models.CharField(
        max_length=20, choices=ConversationType.choices, default=ConversationType.PRIVATE,
    )
    description = models.TextField(blank=True)

    created_by = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True,
        related_name='conversations_created',
    )

    # Contexte optionnel (lier la conversation à une session, un événement, etc.)
    linked_session = models.ForeignKey(
        'cycles.Session', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='conversations',
    )

    is_active = models.BooleanField(default=True)

    # Métadonnées pour accès rapide
    last_message_at = models.DateTimeField(null=True, blank=True)
    message_count = models.PositiveIntegerField(default=0)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'conversations'
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['association', '-last_message_at']),
            models.Index(fields=['association', 'conv_type']),
        ]

    def __str__(self):
        return self.name or f"Conversation {self.conv_type}"


class ConversationMember(TenantAwareModel):
    """
    Participation d'un membre à une conversation.
    Gère les rôles dans la conversation et le statut de lecture.
    """
    class Role(models.TextChoices):
        MEMBER = 'member', 'Membre'
        ADMIN = 'admin', 'Administrateur'

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='members',
    )
    membership = models.ForeignKey(
        'members.Membership', on_delete=models.CASCADE, related_name='chat_memberships',
    )
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.MEMBER,
    )

    # Suivi de lecture
    last_read_at = models.DateTimeField(null=True, blank=True)
    unread_count = models.PositiveIntegerField(default=0)

    # Préférences
    is_muted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)

    joined_at = models.DateTimeField(auto_now_add=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'conversation_members'
        unique_together = ['conversation', 'membership']
        indexes = [
            models.Index(fields=['membership', '-last_read_at']),
        ]


class Message(TenantAwareModel):
    """
    Message dans une conversation.
    Supporte texte, réponses, pièces jointes et messages système.
    """
    class MessageType(models.TextChoices):
        TEXT = 'text', 'Texte'
        IMAGE = 'image', 'Image'
        FILE = 'file', 'Fichier'
        VOICE = 'voice', 'Audio'
        SYSTEM = 'system', 'Système'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(
        'members.Membership', on_delete=models.SET_NULL, null=True,
        related_name='messages_sent',
    )

    content = models.TextField(help_text="Contenu du message")
    message_type = models.CharField(
        max_length=20, choices=MessageType.choices, default=MessageType.TEXT,
    )

    # Réponse à un message
    reply_to = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='replies',
    )

    # Pièces jointes
    attachments = models.JSONField(default=list, blank=True, help_text="""
        [
            {"type": "image", "url": "/media/chat/img.jpg", "name": "photo.jpg", "size": 12345},
            {"type": "file", "url": "/media/chat/doc.pdf", "name": "rapport.pdf", "size": 98765}
        ]
    """)

    # Soft delete
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    class Meta:
        db_table = 'messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['association', 'sender']),
        ]

    def __str__(self):
        preview = self.content[:50] if self.content else '[vide]'
        return f"{self.sender}: {preview}"
```

### Service de Chat

```python
# apps/chat/services.py
from django.db import transaction
from django.utils import timezone


class ChatService:
    """Service pour la gestion des conversations et messages."""

    @classmethod
    @transaction.atomic
    def create_private_conversation(cls, member_a, member_b):
        """
        Crée ou récupère une conversation privée entre deux membres.
        Une seule conversation privée peut exister entre deux membres.
        """
        from apps.chat.models import Conversation, ConversationMember

        # Vérifier si une conversation privée existe déjà
        existing = Conversation.all_objects.filter(
            association=member_a.association,
            conv_type=Conversation.ConversationType.PRIVATE,
            members__membership=member_a,
        ).filter(
            members__membership=member_b,
        ).first()

        if existing:
            return existing

        conv = Conversation.objects.create(
            association=member_a.association,
            conv_type=Conversation.ConversationType.PRIVATE,
            created_by=member_a,
        )

        ConversationMember.objects.create(
            association=member_a.association,
            conversation=conv, membership=member_a,
        )
        ConversationMember.objects.create(
            association=member_a.association,
            conversation=conv, membership=member_b,
        )

        return conv

    @classmethod
    @transaction.atomic
    def create_group_conversation(cls, creator, name, member_ids, description=''):
        """Crée une conversation de groupe."""
        from apps.chat.models import Conversation, ConversationMember
        from apps.members.models import Membership

        conv = Conversation.objects.create(
            association=creator.association,
            name=name,
            description=description,
            conv_type=Conversation.ConversationType.GROUP,
            created_by=creator,
        )

        # Ajouter le créateur comme admin
        ConversationMember.objects.create(
            association=creator.association,
            conversation=conv,
            membership=creator,
            role=ConversationMember.Role.ADMIN,
        )

        # Ajouter les autres membres
        members = Membership.all_objects.filter(
            id__in=member_ids,
            association=creator.association,
            is_active=True,
        ).exclude(id=creator.id)

        for member in members:
            ConversationMember.objects.create(
                association=creator.association,
                conversation=conv,
                membership=member,
            )

        return conv

    @classmethod
    def create_general_conversation(cls, association, creator):
        """
        Crée la conversation générale de l'association.
        Appelé automatiquement à la création de l'association.
        Tous les membres y sont ajoutés automatiquement.
        """
        from apps.chat.models import Conversation, ConversationMember
        from apps.members.models import Membership

        conv, created = Conversation.all_objects.get_or_create(
            association=association,
            conv_type=Conversation.ConversationType.GENERAL,
            defaults={
                'name': f"Général — {association.name}",
                'created_by': creator,
            },
        )

        if created:
            # Ajouter tous les membres actifs
            members = Membership.all_objects.filter(
                association=association, is_active=True,
            )
            for member in members:
                ConversationMember.objects.create(
                    association=association,
                    conversation=conv,
                    membership=member,
                )

        return conv

    @classmethod
    @transaction.atomic
    def send_message(cls, conversation, sender, content,
                     message_type='text', reply_to=None, attachments=None):
        """
        Envoie un message dans une conversation.
        Met à jour les compteurs et notifie les autres membres.
        """
        from apps.chat.models import Message, ConversationMember
        from apps.notifications.services import NotificationService

        msg = Message.objects.create(
            association=conversation.association,
            conversation=conversation,
            sender=sender,
            content=content,
            message_type=message_type,
            reply_to=reply_to,
            attachments=attachments or [],
        )

        # Mettre à jour la conversation
        conversation.last_message_at = msg.created_at
        conversation.message_count = (conversation.message_count or 0) + 1
        conversation.save(update_fields=['last_message_at', 'message_count'])

        # Incrémenter unread_count pour tous les autres membres
        ConversationMember.all_objects.filter(
            conversation=conversation,
        ).exclude(
            membership=sender,
        ).update(
            unread_count=models.F('unread_count') + 1,
        )

        # Notifier les membres non-muted
        other_members = ConversationMember.all_objects.filter(
            conversation=conversation,
            is_muted=False,
        ).exclude(membership=sender).select_related('membership')

        for cm in other_members:
            NotificationService.notify(
                association=conversation.association,
                recipient=cm.membership,
                notification_type='new_message',
                title=f"Message de {sender.user.first_name}",
                body=content[:100],
                data={
                    'conversation_id': str(conversation.id),
                    'message_id': str(msg.id),
                },
                channels=['in_app'],  # Pas de SMS/email pour chaque message
            )

        return msg

    @classmethod
    def mark_conversation_read(cls, conversation, membership):
        """Marque une conversation comme lue pour un membre."""
        from apps.chat.models import ConversationMember

        ConversationMember.all_objects.filter(
            conversation=conversation,
            membership=membership,
        ).update(
            last_read_at=timezone.now(),
            unread_count=0,
        )

    @classmethod
    def delete_message(cls, message, membership):
        """Soft-delete d'un message (seul l'auteur peut supprimer)."""
        if message.sender_id != membership.id:
            raise PermissionError("Vous ne pouvez supprimer que vos propres messages.")

        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.content = "[Message supprimé]"
        message.save(update_fields=['is_deleted', 'deleted_at', 'content'])
```

---

## 4. Signal — Auto-ajout au chat général

```python
# apps/chat/signals.py — Ajouter dans apps/members/signals.py ou apps/chat/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.members.models import Membership


@receiver(post_save, sender=Membership)
def auto_add_to_general_chat(sender, instance, created, **kwargs):
    """
    Quand un nouveau membre rejoint, l'ajouter automatiquement
    à la conversation générale de l'association.
    """
    if not created:
        return
    if instance.status != Membership.Status.ACTIVE:
        return

    from apps.chat.models import Conversation, ConversationMember

    general = Conversation.all_objects.filter(
        association=instance.association,
        conv_type=Conversation.ConversationType.GENERAL,
    ).first()

    if general:
        ConversationMember.objects.get_or_create(
            association=instance.association,
            conversation=general,
            membership=instance,
        )
```

---

## 5. Résumé des Ajouts

### Nouvelles apps

| App | Modèles | Rôle |
|-----|---------|------|
| notifications | Notification, NotificationPreference | Notifications multi-canal avec préférences |
| chat | Conversation, ConversationMember, Message | Messagerie interne entre membres |

### Endpoints ajoutés

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | /api/invitations/check/<token>/ | Vérifier une invitation (public) |
| POST | /api/invitations/register-accept/ | S'inscrire + accepter (public) |
| POST | /api/invitations/login-accept/ | Se connecter + accepter (public) |
| GET | /api/notifications/ | Mes notifications |
| POST | /api/notifications/mark-read/ | Marquer comme lu |
| POST | /api/notifications/mark-all-read/ | Tout marquer comme lu |
| GET | /api/notifications/preferences/ | Préférences de notification |
| PUT | /api/notifications/preferences/ | Modifier les préférences |
| GET | /api/chat/conversations/ | Mes conversations |
| POST | /api/chat/conversations/private/ | Créer conversation privée |
| POST | /api/chat/conversations/group/ | Créer un groupe |
| GET | /api/chat/conversations/<id>/messages/ | Messages d'une conversation |
| POST | /api/chat/conversations/<id>/messages/ | Envoyer un message |
| POST | /api/chat/conversations/<id>/read/ | Marquer comme lu |

### Total modèles : 35

4 globaux + 31 tenant-aware (dont 4 nouveaux)
