# Tontine Project — Gestion d'Associations & Tontines

Application SaaS multi-tenant pour la gestion d'associations et de tontines.

## Stack Technique

- **Backend** : Python 3.12+ / Django 5.x / PostgreSQL 16+
- **API** : Django REST Framework + SimpleJWT
- **Architecture** : Multi-tenant — Shared DB + `association_id`

## Installation

### Prérequis

- Python 3.12+
- PostgreSQL 16+
- pip / virtualenv

### Setup

```bash
# 1. Cloner le projet
git clone <your-repo-url>
cd tontine_project

# 2. Environnement virtuel
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DB, secret key, etc.)

# 5. Créer la base de données
createdb tontine_db

# 6. Lancer les migrations
python manage.py makemigrations core
python manage.py makemigrations members
python manage.py makemigrations tontines
python manage.py makemigrations cycles
python manage.py makemigrations finance
python manage.py makemigrations governance
python manage.py makemigrations sanctions
python manage.py makemigrations events
python manage.py makemigrations subscriptions
python manage.py makemigrations invitations
python manage.py migrate

# 7. Charger les plans par défaut
python manage.py loaddata fixtures/initial_plans.json

# 8. Créer un superuser
python manage.py createsuperuser

# 9. Lancer le serveur
python manage.py runserver
```

## Architecture Multi-Tenant

L'application utilise l'approche **Shared DB + tenant_id** :

- **User** est global (pas de FK vers Association)
- **Membership** lie un User à une Association
- Chaque modèle métier hérite de `TenantAwareModel` qui ajoute `association_id`
- `TenantAwareManager` filtre automatiquement par association active
- `TenantMiddleware` résout l'association via header `X-Tenant`, query param, ou session

### Flux d'utilisation

1. L'utilisateur s'inscrit (global)
2. Il crée une association → devient Fondateur + Président
3. Un trial de 30 jours démarre automatiquement
4. Il invite d'autres membres via email/SMS/WhatsApp/lien
5. Chaque membre se connecte et sélectionne son association active

## API Endpoints

### Auth
- `POST /api/auth/register/` — Inscription
- `POST /api/auth/login/` — Connexion (retourne JWT)
- `POST /api/auth/token/refresh/` — Rafraîchir le token
- `GET  /api/auth/me/` — Profil utilisateur

### Associations
- `GET  /api/auth/associations/` — Mes associations
- `POST /api/auth/associations/create/` — Créer une association
- `POST /api/auth/associations/select/` — Sélectionner l'association active

### Membres (requiert header `X-Tenant: <slug>`)
- `GET/POST /api/members/memberships/`
- `GET/POST /api/members/roles/`
- `GET/POST /api/members/bureau-positions/`
- `GET/POST /api/members/bureau-members/`

### Tontines, Cycles, Finance, etc.
- `GET/POST /api/tontines/...`
- `GET/POST /api/cycles/...`
- `GET/POST /api/finance/...`
- `GET/POST /api/governance/...`
- `GET/POST /api/sanctions/...`
- `GET/POST /api/events/...`
- `GET/POST /api/subscriptions/...`
- `GET/POST /api/invitations/...`

## Structure du Projet

```
tontine_project/
├── config/              # Settings, URLs, WSGI
├── common/              # Couche transversale (models, middleware, permissions)
├── apps/
│   ├── core/            # [GLOBAL] User, Association, Auth
│   ├── members/         # [TENANT] Membership, Role, Bureau
│   ├── tontines/        # [TENANT] TontineType, Souscriptions
│   ├── cycles/          # [TENANT] Cycle, Session, Attendance
│   ├── finance/         # [TENANT] Contribution, Loan, Treasury
│   ├── governance/      # [TENANT] Document, Election, Vote
│   ├── sanctions/       # [TENANT] SanctionType, Sanction
│   ├── events/          # [TENANT] Event, EventAttendance
│   ├── subscriptions/   # [GLOBAL] Plan, Subscription, Payment
│   └── invitations/     # [TENANT] Invitation
├── fixtures/            # Données initiales (plans)
└── scripts/             # Scripts utilitaires
```

## Conventions

- **[GLOBAL]** = modèles sans `association_id`
- **[TENANT]** = modèles avec `association_id` (isolés par TenantAwareModel)
- `objects` = manager filtré par tenant actif
- `all_objects` = manager non filtré (admin, cross-tenant)
- Services dans `services.py` pour la logique métier complexe
- Signaux dans `signals.py` pour l'initialisation automatique

## Phases de Développement

1. **Phase 1** : Core + Members + Subscriptions (fondation) ✅
2. **Phase 2** : Tontines + Cycles + Invitations (flux opérationnel)
3. **Phase 3** : Finance (cotisations, prêts, trésorerie)
4. **Phase 4** : Governance + Sanctions (élections, amendes)
5. **Phase 5** : Events + Notifications + Exports
