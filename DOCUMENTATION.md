# Documentation Complète — Tontine Project

> **Plateforme SaaS multi-tenant** pour la gestion d'associations et de tontines (épargne rotative africaine).

---

## Table des matières

1. [Présentation générale](#1-présentation-générale)
2. [Stack technique](#2-stack-technique)
3. [Architecture](#3-architecture)
4. [Installation & démarrage](#4-installation--démarrage)
5. [Configuration](#5-configuration)
6. [Structure du projet](#6-structure-du-projet)
7. [Multi-tenancy](#7-multi-tenancy)
8. [Authentification & autorisations](#8-authentification--autorisations)
9. [Applications métier](#9-applications-métier)
10. [API REST — endpoints](#10-api-rest--endpoints)
11. [WebSocket (Chat temps réel)](#11-websocket-chat-temps-réel)
12. [Tâches Celery](#12-tâches-celery)
13. [Notifications](#13-notifications)
14. [Abonnements SaaS](#14-abonnements-saas)
15. [Déploiement Docker](#15-déploiement-docker)
16. [Glossaire](#16-glossaire)

---

## 1. Présentation générale

### Qu'est-ce que Tontine Project ?

Une plateforme SaaS multi-tenant permettant à des associations africaines (tontines, mutuelles, cercles d'épargne) de digitaliser :

- La gestion des **membres**, **rôles** et **bureau**
- Les **cycles** annuels et les **séances** (réunions)
- Les **tontines** multiples par cycle (cotisations, enchères, bénéficiaires)
- La **trésorerie**, les **cotisations**, les **prêts** et les **sanctions**
- La **gouvernance** (élections, statuts, règlements)
- Les **événements** (AG, célébrations)
- Les **notifications** multicanal (email, SMS, WhatsApp, push, in-app)
- Le **chat temps réel** avec intégration Jitsi (visioconférence)
- Les **abonnements** et **paiements** de la plateforme elle-même

### Public cible

Associations, mutuelles, groupes de tontines en Afrique francophone (langue par défaut : français, fuseau : Africa/Douala).

---

## 2. Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Django | 5.1.x |
| Langage | Python | 3.12 |
| API REST | Django REST Framework | 3.15.x |
| Auth JWT | djangorestframework-simplejwt | 5.4.x |
| Temps réel | Django Channels + Daphne | 4.2.x |
| Base de données | PostgreSQL | 15 |
| File d'attente | Celery + Celery Beat | 5.4.x |
| Broker/Cache | Redis | 7 |
| Monitoring Celery | Flower | — |
| Docs API | drf-spectacular + drf-yasg | — |
| Push notif | fcm-django + firebase-admin | — |
| PDF/Excel | reportlab, openpyxl | — |
| Téléphones | phonenumbers | — |
| Déploiement | Docker + Docker Compose | — |

---

## 3. Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    Clients (Web, Mobile)                     │
└────────────────┬────────────────────────────┬───────────────┘
                 │ HTTP/REST                  │ WebSocket
                 ▼                            ▼
         ┌───────────────┐          ┌────────────────┐
         │ Django + DRF  │          │    Daphne      │
         │   (Gunicorn)  │          │   (ASGI)       │
         └───────┬───────┘          └────────┬───────┘
                 │                           │
                 ▼                           ▼
         ┌───────────────────────────────────────────┐
         │        TenantMiddleware + Auth JWT        │
         └───────────────────┬───────────────────────┘
                             │
         ┌───────────────────┼───────────────────────┐
         ▼                   ▼                       ▼
  ┌─────────────┐    ┌──────────────┐       ┌──────────────┐
  │ PostgreSQL  │    │    Redis     │       │    Celery    │
  │ (13 apps)   │    │ (broker+chan)│◀──────│worker + beat │
  └─────────────┘    └──────────────┘       └──────────────┘
```

### Patterns architecturaux clés

- **Multi-tenancy partagé** : une seule base, filtrage par `association_id` via `TenantAwareModel` + `TenantMiddleware`.
- **Thread-local tenant** : l'association active est stockée dans un contexte thread-local pour filtrage automatique des querysets.
- **Séparation dev/prod** : `config.settings.dev` et `config.settings.prod`.
- **Async-first** pour le chat, Celery pour les tâches planifiées.

---

## 4. Installation & démarrage

### Prérequis

- Docker + Docker Compose
- (Optionnel hors Docker) Python 3.12, PostgreSQL 15, Redis 7

### Démarrage rapide (Docker)

```bash
# 1. Cloner et se placer dans le projet
cd tontine_project

# 2. Construire et démarrer
docker compose up -d --build

# 3. Vérifier les services
docker compose ps
```

Services lancés :

| Service | Port hôte | Rôle |
|---------|-----------|------|
| `tontine_backend` | 8010 | API Django |
| `tontine_db` | 5440 | PostgreSQL |
| `tontine_redis` | 6388 | Redis |
| `celery_worker` | — | Exécution des tâches |
| `celery_beat` | — | Planification |
| `flower` | 5556 | Monitoring Celery |

### Installation locale (sans Docker)

```bash
python -m venv venv
source venv/bin/activate   # ou venv\Scripts\activate sur Windows
pip install -r requirements.txt

export DJANGO_SETTINGS_MODULE=config.settings.dev
python manage.py migrate
python manage.py loaddata fixtures/initial_plans.json
python manage.py createsuperuser
python manage.py runserver
```

Dans deux autres terminaux :

```bash
celery -A config worker -l info
celery -A config beat -l info
```

---

## 5. Configuration

### Variables d'environnement

| Variable | Par défaut | Description |
|----------|------------|-------------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | Module de settings |
| `POSTGRES_DB` | `tontine_db` | Base de données |
| `POSTGRES_USER` | `tontine` | Utilisateur PG |
| `POSTGRES_PASSWORD` | — | Mot de passe PG |
| `POSTGRES_HOST` | `postgres` | Hôte PG |
| `POSTGRES_PORT` | `5432` | Port PG |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Broker Celery |
| `RUN_MIGRATIONS` | `false` | Lance `migrate` au démarrage |

Voir [config/settings/base.py](config/settings/base.py) pour la liste complète.

### Fichiers de configuration

- [config/settings/base.py](config/settings/base.py) — config commune
- [config/settings/dev.py](config/settings/dev.py) — surcharges dev
- [config/settings/prod.py](config/settings/prod.py) — surcharges prod
- [config/celery.py](config/celery.py) — app Celery + beat schedule
- [config/urls.py](config/urls.py) — routes racine
- [config/asgi.py](config/asgi.py) — entrée ASGI (WebSocket)
- [config/wsgi.py](config/wsgi.py) — entrée WSGI (HTTP)

---

## 6. Structure du projet

```
tontine_project/
├── apps/
│   ├── core/              # User, Association, Auth, FCM
│   ├── members/           # Membership, Role, Bureau
│   ├── tontines/          # TontineType, MemberSubscription
│   ├── cycles/            # Cycle, Session, Pot, Payout, Bid
│   ├── finance/           # Contribution, Loan, Transaction
│   ├── governance/        # Document, Election, Vote
│   ├── sanctions/         # SanctionType, Sanction
│   ├── events/            # Event, EventAttendance
│   ├── subscriptions/     # Plan, Subscription, Payment (global)
│   ├── invitations/       # Invitation
│   ├── notifications/     # Notification, Preference
│   └── chat/              # Conversation, Message, Consumer WS
├── common/
│   ├── models.py          # TimeStampedModel, TenantAwareModel
│   ├── managers.py        # TenantAwareManager + thread-local
│   ├── middleware.py      # TenantMiddleware, SubscriptionMiddleware
│   └── permissions.py     # HasAssociation, IsMember, HasPermission
├── config/
│   ├── settings/          # base.py, dev.py, prod.py
│   ├── celery.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── fixtures/
│   └── initial_plans.json # Plans d'abonnement initiaux
├── scripts/               # Utilitaires
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── manage.py
└── requirements.txt
```

---

## 7. Multi-tenancy

### Principe

- **User** est global (pas de FK `association`).
- Toute autre entité métier hérite de `TenantAwareModel` → FK `association_id`.
- Le contexte `association` est résolu par le middleware à chaque requête.

### Résolution du tenant

`TenantMiddleware` lit dans cet ordre :

1. Header HTTP `X-Tenant: <slug>`
2. Query param `?tenant=<slug>`
3. Session Django (`request.session['association_slug']`)

Si aucun n'est fourni, les endpoints nécessitant `HasAssociation` renvoient **403**.

### Filtrage automatique

```python
# common/models.py
class TenantAwareModel(models.Model):
    association = models.ForeignKey('core.Association', ...)
    objects = TenantAwareManager()       # auto-filtré
    all_objects = models.Manager()       # bypass (admin uniquement)

    class Meta:
        abstract = True
```

`TenantAwareManager.get_queryset()` applique `.filter(association=get_current_association())`.

### Isolation garantie

- Tout `Model.objects.all()` est déjà filtré par tenant.
- Les endpoints ViewSet ne renvoient **jamais** de données d'une autre association.
- Utiliser `Model.all_objects` **uniquement** pour les tâches cross-tenant (Celery beat par exemple).

---

## 8. Authentification & autorisations

### Modèle User

- PK : UUID
- USERNAME_FIELD : `telephone` (unique, format E.164 via `phonenumbers`)
- Pas d'email obligatoire
- Backend custom : `TelephoneBackend`

### Flow d'inscription & connexion

```
1. POST /api/auth/register/          → crée User + PhoneOtpUser + envoie OTP
2. POST /api/auth/validate-otp/      → active le compte
3. POST /api/auth/login/             → renvoie access + refresh JWT
4. Utilisation : Header Authorization: Bearer <access_token>
5. Header X-Tenant: <association_slug> pour les endpoints tenant
```

### Reset password

```
1. POST /api/auth/forgot-password/   → OTP envoyé
2. POST /api/auth/validate-otp/      → flag validé
3. POST /api/auth/change-password/   → nouveau mot de passe
```

### Durée des tokens

| Token | TTL |
|-------|-----|
| Access | 2h |
| Refresh | 7j |

### Permissions DRF custom ([common/permissions.py](common/permissions.py))

| Classe | Rôle |
|--------|------|
| `IsAuthenticated` | User connecté |
| `HasAssociation` | Tenant résolu |
| `IsMember` | User est membre actif du tenant |
| `HasPermission('xxx')` | Rôle possède la permission `xxx` (wildcard supporté) |

Exemple :

```python
class LoanViewSet(ModelViewSet):
    permission_classes = [IsMember, HasPermission('finance.manage_loans')]
```

### Système de rôles

- Chaque association définit ses propres `Role` (ex : "Trésorier", "Secrétaire").
- Un `Role` contient une liste de permissions JSON : `["finance.*", "tontine.view"]`.
- Wildcards supportés : `*` (toutes), `app.*` (toutes dans l'app).
- Un membre (`Membership`) peut avoir plusieurs rôles via `MemberRole`.

---

## 9. Applications métier

### 9.1 `apps.core` — Utilisateurs & associations

| Modèle | Rôle |
|--------|------|
| `User` | Utilisateur global (UUID, telephone) |
| `PhoneOtpUser` | OTP pour login/reset |
| `FCMToken` | Token push (android/ios/web) |
| `Association` | Tenant (slug unique) |

**Endpoints clés** : `/api/auth/*`, `/api/associations/*`

### 9.2 `apps.members` — Membres & bureau

| Modèle | Rôle |
|--------|------|
| `Membership` | Identité du user dans l'association (numéro auto `TNT240325ND01`) |
| `Role` | Rôle personnalisable avec permissions |
| `MemberRole` | Assignation Role ↔ Membership |
| `BureauPosition` | Poste de bureau (président, trésorier…) |
| `BureauMember` | Titulaire d'un poste pour un cycle |

**Statuts `Membership`** : `pending → active → suspended/expelled/resigned`

### 9.3 `apps.tontines` — Définition des tontines

| Modèle | Rôle |
|--------|------|
| `TontineType` | Type de tontine (principale, scolarité, épargne…) |
| `MemberSubscription` | Souscription d'un membre pour un cycle |

**Modes de taux** : `fixed` (imposé), `range` (min/max), `free` (libre)
**Parts multiples** : un membre peut prendre plusieurs « bouches » ou « mains ».

### 9.4 `apps.cycles` — Cycles, séances, pots

| Modèle | Rôle |
|--------|------|
| `Cycle` | Période d'activité (1 an typiquement) |
| `CycleTontineConfig` | Config d'une tontine pour un cycle (méthode d'acquisition) |
| `Session` | Réunion/rencontre |
| `SessionAttendance` | Présence (present/absent/excused/late/represented) |
| `BeneficiarySchedule` | Ordre prévisionnel des bénéficiaires |
| `SessionPot` | Cagnotte d'une tontine pour une séance |
| `BeneficiaryPayout` | Versement au bénéficiaire (avec garant, signature) |
| `AuctionBid` | Enchère sur un pot |

**Méthodes d'acquisition** (`AcquisitionMethod`) :

- `random` — tirage aléatoire
- `sequential` — ordre fixe
- `auction` — enchères (prime au plus offrant)
- `vote` — vote des membres
- `need_based` — selon besoin déclaré
- `manual` — désignation

**Endpoints spécialisés** :

- `POST /api/cycles/pots/<id>/open/` — ouvrir le pot
- `POST /api/cycles/pots/<id>/auction/` — lancer enchère
- `POST /api/cycles/pots/<id>/distribute/` — distribuer
- `POST /api/cycles/pots/<id>/close/` — clôturer

### 9.5 `apps.finance` — Finance

| Modèle | Rôle |
|--------|------|
| `Contribution` | Cotisation d'un membre à une séance |
| `Loan` | Prêt à un membre |
| `LoanRepayment` | Remboursement |
| `TreasuryAccount` | Compte trésorerie (cash/banque/mobile money) |
| `Transaction` | Écriture comptable |

**Statuts contribution** : `pending/paid/partial/defaulted`
**Statuts prêt** : `pending/approved/disbursed/repaying/repaid/defaulted`

### 9.6 `apps.governance` — Gouvernance

| Modèle | Rôle |
|--------|------|
| `Document` | Statuts, règlement, amendements (versionné) |
| `Election` | Élection du bureau |
| `ElectionCandidate` | Candidat à un poste |
| `Vote` | Vote (voter=NULL si scrutin secret) |

### 9.7 `apps.sanctions` — Sanctions

| Modèle | Rôle |
|--------|------|
| `SanctionType` | Type de sanction (absence, retard…) avec montant fixe ou fourchette |
| `Sanction` | Sanction appliquée (pending/paid/waived/contested) |

### 9.8 `apps.events` — Événements

| Modèle | Rôle |
|--------|------|
| `Event` | AG, AGE, atelier, célébration |
| `EventAttendance` | Présence à l'événement |

### 9.9 `apps.notifications` — Notifications

| Modèle | Rôle |
|--------|------|
| `Notification` | Notification (32 types, 5 canaux) |
| `NotificationPreference` | Préférences par membre (canaux, mute, heures calmes) |

**Canaux** : `in_app`, `email`, `sms`, `whatsapp`, `push` (FCM)

Voir [section 13](#13-notifications) pour le détail.

### 9.10 `apps.subscriptions` — Abonnements SaaS (GLOBAL)

> Ces modèles ne sont **pas tenant-aware** : ils concernent l'abonnement de l'association elle-même à la plateforme.

| Modèle | Rôle |
|--------|------|
| `Plan` | Plan tarifaire (prix, limites, features) |
| `Subscription` | Abonnement d'une association (1:1) |
| `Payment` | Historique des paiements |

**Statuts** : `trialing → active → past_due → expired/cancelled/suspended`

### 9.11 `apps.invitations` — Invitations

| Modèle | Rôle |
|--------|------|
| `Invitation` | Invitation à rejoindre une association (token sécurisé) |

**Canaux** : `email`, `sms`, `whatsapp`, `link`
**Flows** : accept (user existant), register+accept (nouveau), login+accept (retour)

### 9.12 `apps.chat` — Chat temps réel

| Modèle | Rôle |
|--------|------|
| `Conversation` | Canal (private/group/bureau/session/general) |
| `ConversationMember` | Appartenance à un canal |
| `Message` | Message (text/image/file/voice/system) |

Intégration **Jitsi** pour visioconférence. Voir [section 11](#11-websocket-chat-temps-réel).

---

## 10. API REST — endpoints

### Convention globale

- Base URL : `http://<host>:8010/api/`
- Auth : `Authorization: Bearer <JWT>`
- Tenant : `X-Tenant: <association_slug>`
- Pagination : `?page=N` (taille 20)
- Filtres : `?search=...`, `?ordering=...`, filtres spécifiques via `django-filter`

### Récapitulatif des routes

| Préfixe | App | Description |
|---------|-----|-------------|
| `/api/auth/` | core | Register, login, OTP, password |
| `/api/associations/` | core | Gestion associations |
| `/api/members/` | members | Membres, rôles, bureau |
| `/api/tontines/` | tontines | Types et souscriptions |
| `/api/cycles/` | cycles | Cycles, séances, pots, enchères |
| `/api/finance/` | finance | Cotisations, prêts, transactions |
| `/api/governance/` | governance | Documents, élections, votes |
| `/api/sanctions/` | sanctions | Types et sanctions |
| `/api/events/` | events | Événements et présences |
| `/api/notifications/` | notifications | Notifications et préférences |
| `/api/subscriptions/` | subscriptions | Plans et abonnements SaaS |
| `/api/invitations/` | invitations | Invitations |
| `/api/chat/` | chat | Conversations et messages |

### Documentation interactive

- **Swagger UI** : `/api/schema/swagger-ui/`
- **ReDoc** : `/api/schema/redoc/`
- **Schema OpenAPI** : `/api/schema/`

### Exemples d'endpoints critiques

#### Inscription + OTP

```http
POST /api/auth/register/
{
  "telephone": "+237690000000",
  "password": "secret123",
  "first_name": "Amadou",
  "last_name": "Diallo"
}
```

#### Login

```http
POST /api/auth/login/
{"telephone": "+237690000000", "password": "secret123"}

→ {"access": "...", "refresh": "...", "user": {...}}
```

#### Créer une association

```http
POST /api/associations/
Authorization: Bearer <access>
{
  "name": "Tontine des Amis",
  "slug": "tontine-amis",
  "city": "Douala",
  "country": "CM"
}
```

#### Lister les membres (tenant requis)

```http
GET /api/members/memberships/
Authorization: Bearer <access>
X-Tenant: tontine-amis
```

---

## 11. WebSocket (Chat temps réel)

### Endpoint

```
ws://<host>:8010/ws/chat/<conversation_id>/?token=<access_jwt>
```

### Consumer

- [apps/chat/consumers.py](apps/chat/consumers.py) → `ChatConsumer` (AsyncWebsocketConsumer)
- Auth JWT via query param
- Broadcast dans un group `chat_<conversation_id>`

### Types de messages supportés

| Type | Description |
|------|-------------|
| `chat.message` | Texte, image, fichier, vocal |
| `chat.typing` | Indicateur de frappe |
| `chat.read` | Accusé de lecture |
| `chat.delete` | Suppression |
| `chat.reply` | Réponse à un message |
| `jitsi.start_session` | Démarre un appel vidéo |
| `jitsi.end_session` | Termine l'appel |
| `jitsi.participant_join` | Participant entre |
| `jitsi.participant_leave` | Participant sort |

### Channel layer

- **Dev** : `channels.layers.InMemoryChannelLayer`
- **Prod** : `channels_redis.core.RedisChannelLayer`

### Exemple client (JS)

```javascript
const ws = new WebSocket(
  `ws://localhost:8010/ws/chat/${conversationId}/?token=${accessToken}`
);

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'chat.message') console.log(data.message);
};

ws.send(JSON.stringify({
  type: 'chat.message',
  content: 'Bonjour à tous !',
  message_type: 'text'
}));
```

Voir aussi [CHAT_WEBSOCKET_CONFIG.md](CHAT_WEBSOCKET_CONFIG.md) et [CHAT_API_EXAMPLES.md](CHAT_API_EXAMPLES.md).

---

## 12. Tâches Celery

### Configuration

- App : [config/celery.py](config/celery.py)
- Broker & backend : Redis
- Auto-discovery : `apps.*.tasks`
- Timezone : `Africa/Douala`

### Commandes

```bash
celery -A config worker -l info
celery -A config beat -l info
celery -A config flower --port=5555    # monitoring
```

### Planification (`beat_schedule`)

| Nom | Tâche | Horaire | Kwargs |
|-----|-------|---------|--------|
| `session-reminder-24h` | `apps.notifications.tasks.send_session_reminders` | 08:00 chaque jour | `hours_before=24` |
| `session-reminder-2h` | `apps.notifications.tasks.send_session_reminders` | Toutes les 30 min | `hours_before=2` |
| `loan-reminder-3days` | `apps.notifications.tasks.send_loan_reminders` | 09:00 chaque jour | `days_before=3` |
| `loan-reminder-due-today` | `apps.notifications.tasks.send_loan_reminders` | 08:00 chaque jour | `days_before=0` |
| `loan-overdue-check` | `apps.notifications.tasks.check_overdue_loans` | 10:00 chaque jour | — |
| `contribution-unpaid-reminder` | `apps.notifications.tasks.send_contribution_reminders` | 18:00 chaque jour | — |
| `trial-expiring-reminder` | `apps.notifications.tasks.check_expiring_trials` | 09:00 chaque jour | — |
| `expire-subscriptions` | `apps.subscriptions.tasks.expire_overdue_subscriptions` | 00:30 chaque jour | — |
| `expire-invitations` | `apps.invitations.tasks.expire_old_invitations` | 01:00 chaque jour | — |

### Ajouter une tâche

```python
# apps/mon_app/tasks.py
from celery import shared_task

@shared_task
def ma_tache(arg1):
    ...

# Dans config/celery.py, ajouter à beat_schedule
'nom-tache': {
    'task': 'apps.mon_app.tasks.ma_tache',
    'schedule': crontab(hour=12, minute=0),
},
```

---

## 13. Notifications

### Architecture

```
Événement métier
      │
      ▼
  Signal / Task Celery
      │
      ▼
  NotificationService
      │
      ├──▶ In-app (BDD)
      ├──▶ Email (Django EmailBackend)
      ├──▶ SMS (provider configurable)
      ├──▶ WhatsApp (provider configurable)
      └──▶ Push (FCM via fcm-django)
```

### Types de notifications (32)

Catégories principales :

- **Membres** : `member_joined`, `member_suspended`, `member_role_changed`
- **Séances** : `session_scheduled`, `session_reminder`, `session_cancelled`
- **Finance** : `contribution_due`, `loan_approved`, `loan_due`, `loan_overdue`
- **Gouvernance** : `election_started`, `vote_cast`, `document_published`
- **Abonnement** : `trial_expiring`, `subscription_expired`, `payment_failed`
- **Chat** : `new_message`, `mention`, `call_started`

### Préférences utilisateur

Chaque `Membership` peut configurer :

- Canaux activés (email/sms/whatsapp/push)
- `muted_types` : liste de types à ignorer
- `quiet_hours_start` / `quiet_hours_end` : heures de silence

---

## 14. Abonnements SaaS

### Modèle

- Une `Association` a exactement une `Subscription` (1:1).
- Un `Plan` définit : prix, période d'essai, limites (membres, tontines, cycles), features.
- `SubscriptionMiddleware` vérifie la validité à chaque requête → **402 Payment Required** si expiré.

### Cycle de vie

```
     Création association
            │
            ▼
        trialing ──────► (fin de trial) ─────► expired
            │
            ▼ (paiement validé)
         active ──────► (non-paiement) ────► past_due ────► suspended
            │
            ▼ (annulation user)
        cancelled
```

### Extension

- Providers de paiement : champ `payment_provider` + `payment_provider_data` JSON (Stripe, Orange Money, MTN MoMo…).
- Tâche quotidienne `expire_overdue_subscriptions` à 00:30 : expire les abonnements échus et notifie les présidents.

---

## 15. Déploiement Docker

### Services ([docker-compose.yml](docker-compose.yml))

```yaml
services:
  postgres:       # tontine_db       (5440:5432)
  redis:          # tontine_redis    (6388:6379)
  backend:        # tontine_backend  (8010:8000)
  celery_worker:  # celery_worker
  celery_beat:    # celery_beat
  flower:         # flower           (5556:5555)
```

### Dockerfile

- Base : `python:3.12-slim`
- Entrypoint : [entrypoint.sh](entrypoint.sh) (attend PG, applique migrations si `RUN_MIGRATIONS=true`, exec la commande).

### Commandes utiles

```bash
# Logs d'un service
docker compose logs -f backend

# Shell Django
docker compose exec backend python manage.py shell

# Migrations
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Superuser
docker compose exec backend python manage.py createsuperuser

# Charger les plans d'abonnement
docker compose exec backend python manage.py loaddata fixtures/initial_plans.json

# Redémarrer Celery après modification du schedule
docker compose restart celery_beat celery_worker

# Monitoring Celery
open http://localhost:5556
```

### Production — checklist

- [ ] `DJANGO_SETTINGS_MODULE=config.settings.prod`
- [ ] `SECRET_KEY` depuis variable d'environnement
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` correctement défini
- [ ] PostgreSQL et Redis avec mots de passe
- [ ] HTTPS via reverse-proxy (Nginx/Traefik)
- [ ] `channels_redis` configuré (pas InMemory)
- [ ] Backups PG automatiques
- [ ] FCM credentials (fichier service account)
- [ ] Providers SMS/WhatsApp configurés
- [ ] Stockage S3/Cloudinary pour médias

---

## 16. Glossaire

| Terme | Définition |
|-------|------------|
| **Tontine** | Épargne rotative : chacun cotise à chaque séance, un membre reçoit le pot à tour de rôle |
| **Cycle** | Période d'activité d'une tontine (souvent 1 an) |
| **Séance** | Réunion périodique où on collecte et distribue |
| **Pot / Cagnotte** | Somme collectée pour une tontine à une séance |
| **Bénéficiaire** | Membre qui reçoit le pot |
| **Bouche / Main / Part** | Unité de participation (un membre peut avoir plusieurs parts) |
| **Enchère** | Mécanisme où le bénéficiaire est désigné par l'offre la plus haute |
| **Garant** | Membre qui cautionne le remboursement d'un bénéficiaire ou d'un prêt |
| **Bureau** | Instance dirigeante (président, trésorier, secrétaire…) |
| **Report / Carry-over** | Reste d'un pot non distribué reporté à la séance suivante |
| **Prime d'enchère** | Différence entre offre et montant nominal du pot |

---

## Documentation complémentaire

- [README.md](README.md) — vue d'ensemble
- [QUICK_START_CHAT.md](QUICK_START_CHAT.md) — démarrage rapide chat
- [CHAT_DOCUMENTATION_INDEX.md](CHAT_DOCUMENTATION_INDEX.md) — index docs chat
- [CHAT_IMPLEMENTATION_SUMMARY.md](CHAT_IMPLEMENTATION_SUMMARY.md) — implémentation chat
- [CHAT_WEBSOCKET_CONFIG.md](CHAT_WEBSOCKET_CONFIG.md) — config WebSocket
- [CHAT_URLS_CONFIGURATION.md](CHAT_URLS_CONFIGURATION.md) — routes chat
- [CHAT_API_EXAMPLES.md](CHAT_API_EXAMPLES.md) — exemples API
- [AJOUTS_ONBOARDING_NOTIFICATIONS_CHAT.md](AJOUTS_ONBOARDING_NOTIFICATIONS_CHAT.md) — ajouts onboarding/notif/chat

---

*Documentation générée le 2026-04-21 — projet en français, fuseau Africa/Douala.*
