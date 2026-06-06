# Documentation de tests Postman — Tontine Project

> Guide complet pour tester l'API via Postman, application par application.

---

## Configuration Postman globale

### Environnement suggéré

Créer un environnement Postman avec ces variables :

| Variable | Valeur initiale |
|----------|----------------|
| `base_url` | `http://localhost:8010/api` |
| `access_token` | *(rempli après login)* |
| `refresh_token` | *(rempli après login)* |
| `tenant_slug` | `tontine-amis` *(slug de votre association)* |
| `user_id` | *(rempli après login)* |
| `membership_id` | *(rempli après création membre)* |
| `cycle_id` | *(rempli après création cycle)* |
| `session_id` | *(rempli après création séance)* |
| `pot_id` | *(rempli après ouverture pot)* |

### Headers par défaut

Pour toutes les requêtes **authentifiées** :

```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

Pour toutes les requêtes **tenant-aware** (presque toutes sauf auth) :

```
X-Tenant: {{tenant_slug}}
```

### Script de pré-requête — auto-refresh token

À placer dans l'onglet **Pre-request Script** de la collection :

```javascript
const token = pm.environment.get("access_token");
if (!token) {
    console.warn("Access token manquant — faire login d'abord");
}
```

### Test script réutilisable — sauvegarder tokens après login

À placer dans **Tests** des endpoints `register/` et `login/` :

```javascript
pm.test("Login successful", () => {
    pm.response.to.have.status(200);
    const data = pm.response.json();
    pm.environment.set("access_token", data.tokens.access);
    pm.environment.set("refresh_token", data.tokens.refresh);
    pm.environment.set("user_id", data.user.id);
});
```

### Codes de statut HTTP courants

| Code | Signification |
|------|---------------|
| 200 | OK |
| 201 | Ressource créée |
| 204 | Pas de contenu |
| 400 | Données invalides |
| 401 | Token manquant/invalide |
| 402 | Abonnement expiré |
| 403 | Permission refusée |
| 404 | Ressource introuvable |
| 500 | Erreur serveur |

---

## 1. `apps.core` — Authentification & associations

Base : `{{base_url}}/auth/` et `{{base_url}}/associations/`

### 1.1 Inscription

**`POST {{base_url}}/auth/register/`**

Body (JSON) :
```json
{
  "telephone": "+237690000001",
  "first_name": "Amadou",
  "last_name": "Diallo",
  "email": "amadou@example.com",
  "password": "motdepasse123",
  "password_confirm": "motdepasse123"
}
```

Test :
```javascript
pm.test("User created", () => {
    pm.response.to.have.status(201);
    const data = pm.response.json();
    pm.environment.set("access_token", data.tokens.access);
    pm.environment.set("refresh_token", data.tokens.refresh);
    pm.environment.set("user_id", data.user.id);
});
```

### 1.2 Validation OTP

**`POST {{base_url}}/auth/valid-otp/`**

```json
{
  "telephone": "+237690000001",
  "otp": "123456"
}
```

### 1.3 Connexion

**`POST {{base_url}}/auth/login/`**

```json
{
  "telephone": "+237690000001",
  "password": "motdepasse123"
}
```

### 1.4 Rafraîchir le token

**`POST {{base_url}}/auth/token/refresh/`**

```json
{
  "refresh": "{{refresh_token}}"
}
```

### 1.5 Mot de passe oublié

**`POST {{base_url}}/auth/change-fogot-password/`**

```json
{
  "telephone": "+237690000001",
  "password": "nouveau_mdp"
}
```

### 1.6 Changer mot de passe

**`POST {{base_url}}/auth/change-password/`**

```json
{
  "telephone": "+237690000001",
  "old_password": "motdepasse123",
  "new_password": "nouveau_mdp"
}
```

### 1.7 Profil connecté

**`GET {{base_url}}/auth/me/`** (Auth requise)

**`PATCH {{base_url}}/auth/me/`**
```json
{
  "first_name": "Amadou",
  "last_name": "Diallo",
  "email": "new@example.com",
  "language": "fr"
}
```

### 1.8 Enregistrer token FCM

**`POST {{base_url}}/auth/register-fcm-token/`**

```json
{
  "token": "fcm_xyz123...",
  "device_type": "android"
}
```

### 1.9 Associations de l'utilisateur

**`GET {{base_url}}/associations/associations/`**

### 1.10 Créer une association

**`POST {{base_url}}/associations/associations/create/`**

```json
{
  "name": "Tontine des Amis",
  "slug": "tontine-amis",
  "description": "Association entraide",
  "city": "Douala",
  "region": "Littoral"
}
```

Test :
```javascript
pm.environment.set("tenant_slug", pm.response.json().association.slug);
```

### 1.11 Sélectionner association active

**`POST {{base_url}}/associations/associations/select/`**

```json
{"slug": "{{tenant_slug}}"}
```

### 1.12 Détail / mise à jour association

**`GET {{base_url}}/associations/associations/{{tenant_slug}}/`**

**`PATCH {{base_url}}/associations/associations/{{tenant_slug}}/`**

JSON :
```json
{
  "name": "Tontine des Amis de Douala",
  "description": "Mise à jour",
  "city": "Douala",
  "country": "Cameroun",
  "settings": {
    "currency": "XAF",
    "allow_multiple_names": true
  }
}
```

Ou **multipart/form-data** pour upload logo :
| Key | Type | Value |
|-----|------|-------|
| name | Text | Tontine des Amis |
| logo | File | logo.png |

### 1.13 Users (CRUD)

**`GET {{base_url}}/auth/user/`** — liste
**`GET {{base_url}}/auth/user/{id}/`** — détail
**`POST {{base_url}}/auth/user/`** — créer
**`PATCH {{base_url}}/auth/user/{id}/`** — modifier
**`DELETE {{base_url}}/auth/user/{id}/`** — supprimer

---

## 2. `apps.members` — Membres, rôles, bureau

Base : `{{base_url}}/members/`
Headers : `Authorization`, `X-Tenant`

### 2.1 Memberships (CRUD)

**`GET {{base_url}}/members/memberships/`**
Query params : `?status=active&search=amadou&page=1`

**`POST {{base_url}}/members/memberships/`**
```json
{
  "user": "uuid-utilisateur",
  "cni_number": "123456789",
  "status": "active",
  "extra_data": {}
}
```

**`GET {{base_url}}/members/memberships/{id}/`**
**`PATCH {{base_url}}/members/memberships/{id}/`**
```json
{"status": "suspended"}
```
**`DELETE {{base_url}}/members/memberships/{id}/`**

### 2.2 Roles (CRUD)

**`GET {{base_url}}/members/roles/`**

**`POST {{base_url}}/members/roles/`**
```json
{
  "name": "Trésorier",
  "slug": "tresorier",
  "description": "Gère la trésorerie",
  "permissions": ["finance.*", "sanctions.collect"],
  "is_bureau_role": true,
  "hierarchy_level": 2
}
```

**`PATCH {{base_url}}/members/roles/{id}/`**
**`DELETE {{base_url}}/members/roles/{id}/`** *(bloqué si `is_system=true`)*

### 2.3 Postes de bureau

**`GET {{base_url}}/members/bureau-positions/`**
**`POST {{base_url}}/members/bureau-positions/`**
```json
{
  "name": "Président",
  "slug": "president",
  "description": "Représente l'association",
  "display_order": 1,
  "is_required": true,
  "default_role": "uuid-role-president"
}
```

### 2.4 Bureau members

**`GET {{base_url}}/members/bureau-members/`**
**`POST {{base_url}}/members/bureau-members/`**
```json
{
  "membership": "uuid-membership",
  "position": "uuid-position",
  "cycle": "uuid-cycle",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "designation_method": "election",
  "is_active": true
}
```

---

## 3. `apps.tontines` — Types de tontine & souscriptions

Base : `{{base_url}}/tontines/`

### 3.1 Types de tontine

**`GET {{base_url}}/tontines/types/`**
Filtres : `?is_active=true&rate_mode=fixed`

**`POST {{base_url}}/tontines/types/`**
```json
{
  "name": "Tontine principale",
  "slug": "tontine-principale",
  "description": "Cotisation mensuelle",
  "rate_mode": "fixed",
  "fixed_rate": 10000,
  "currency": "XAF",
  "allows_multiple_shares": true,
  "max_shares_per_member": 3,
  "share_unit_name": "main",
  "has_beneficiary": true,
  "is_active": true,
  "display_order": 1
}
```

### 3.2 Souscriptions membres

**`GET {{base_url}}/tontines/subscriptions/`**
Filtres : `?cycle=<uuid>&tontine_type=<uuid>`

**`POST {{base_url}}/tontines/subscriptions/`**
```json
{
  "membership": "uuid-membership",
  "tontine_type": "uuid-tontine-type",
  "cycle": "uuid-cycle",
  "num_shares": 2,
  "rate_per_share": 10000
}
```

---

## 4. `apps.cycles` — Cycles, séances, pots

Base : `{{base_url}}/cycles/`

### 4.1 Cycles

**`GET {{base_url}}/cycles/cycles/`**

**`POST {{base_url}}/cycles/cycles/`**
```json
{
  "name": "Cycle 2026",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "status": "draft",
  "session_frequency": "monthly",
  "default_session_day": "saturday",
  "default_session_time": "18:00",
  "default_session_location": "Siège de l'association"
}
```

Test :
```javascript
pm.environment.set("cycle_id", pm.response.json().id);
```

### 4.2 Config tontines du cycle

**`GET {{base_url}}/cycles/configs/`**
**`POST {{base_url}}/cycles/configs/`**
```json
{
  "cycle": "{{cycle_id}}",
  "tontine_type": "uuid-tontine",
  "default_method": "sequential",
  "allow_override": true,
  "allowed_overrides": ["auction", "vote"],
  "auction_premium_destination": "treasury",
  "config": {}
}
```

### 4.3 Séances

**`GET {{base_url}}/cycles/sessions/`**
Filtres : `?cycle={{cycle_id}}&status=scheduled`

**`POST {{base_url}}/cycles/sessions/`**
```json
{
  "cycle": "{{cycle_id}}",
  "session_number": 1,
  "date": "2026-02-15",
  "start_time": "18:00",
  "end_time": "20:00",
  "location": "Siège",
  "status": "scheduled",
  "notes": ""
}
```

Test :
```javascript
pm.environment.set("session_id", pm.response.json().id);
```

### 4.4 Présences

**`GET {{base_url}}/cycles/attendances/?session={{session_id}}`**
**`POST {{base_url}}/cycles/attendances/`**
```json
{
  "session": "{{session_id}}",
  "membership": "uuid-membership",
  "status": "present",
  "notes": ""
}
```

### 4.5 Ouvrir un pot

**`POST {{base_url}}/cycles/sessions/{{session_id}}/open-pot/`**
```json
{
  "tontine_type_id": "uuid-tontine",
  "override_method": "auction",
  "override_reason": "Décision de bureau"
}
```

Test :
```javascript
pm.environment.set("pot_id", pm.response.json().pot.id);
```

### 4.6 Enchère

**`POST {{base_url}}/cycles/pots/{{pot_id}}/auction/`**
```json
{
  "winner_membership_id": "uuid-membership",
  "bid_amount": 5000
}
```

### 4.7 Distribuer un pot

**`POST {{base_url}}/cycles/pots/{{pot_id}}/distribute/`**
```json
{
  "membership_id": "uuid-beneficiaire",
  "shares_claimed": 2
}
```

### 4.8 Clôturer un pot

**`POST {{base_url}}/cycles/pots/{{pot_id}}/close/`**
*(pas de body)*

### 4.9 Consultations (read-only)

**`GET {{base_url}}/cycles/pots/`** — liste des pots
**`GET {{base_url}}/cycles/payouts/`** — versements bénéficiaires
**`GET {{base_url}}/cycles/bids/?pot={{pot_id}}`** — enchères

### 4.10 Créer une enchère

**`POST {{base_url}}/cycles/bids/`**
```json
{
  "pot": "{{pot_id}}",
  "membership": "uuid-membership",
  "bid_amount": 7500
}
```

---

## 5. `apps.finance` — Finance

Base : `{{base_url}}/finance/`

### 5.1 Cotisations

**`GET {{base_url}}/finance/contributions/?session={{session_id}}&status=paid`**
**`POST {{base_url}}/finance/contributions/`**
```json
{
  "session": "{{session_id}}",
  "membership": "uuid-membership",
  "tontine_type": "uuid-tontine",
  "num_shares": 2,
  "rate_per_share": 10000,
  "expected_amount": 20000,
  "paid_amount": 20000,
  "status": "paid",
  "paid_at": "2026-02-15T18:30:00Z",
  "payment_method": "cash",
  "receipt_number": "RCPT-001"
}
```

### 5.2 Prêts

**`GET {{base_url}}/finance/loans/?status=approved`**
**`POST {{base_url}}/finance/loans/`**
```json
{
  "membership": "uuid-emprunteur",
  "amount": 100000,
  "interest_rate": 5.0,
  "total_due": 105000,
  "session_granted": "{{session_id}}",
  "due_date": "2026-06-30",
  "purpose": "Frais scolarité",
  "status": "pending"
}
```

### 5.3 Remboursements

**`POST {{base_url}}/finance/loan-repayments/`**
```json
{
  "loan": "uuid-pret",
  "session": "{{session_id}}",
  "amount": 20000,
  "payment_method": "mobile_money",
  "notes": "Remboursement partiel"
}
```

### 5.4 Comptes de trésorerie

**`GET {{base_url}}/finance/treasury/`**
**`POST {{base_url}}/finance/treasury/`**
```json
{
  "name": "Caisse principale",
  "account_type": "cash",
  "description": "Espèces du bureau",
  "is_active": true
}
```

### 5.5 Transactions (read-only)

**`GET {{base_url}}/finance/transactions/?account=<uuid>&transaction_type=contribution`**

---

## 6. `apps.governance` — Gouvernance

Base : `{{base_url}}/governance/`

### 6.1 Documents

**`GET {{base_url}}/governance/documents/?doc_type=bylaws&is_active=true`**
**`POST {{base_url}}/governance/documents/`**

Multipart ou JSON :
```json
{
  "doc_type": "bylaws",
  "title": "Statuts 2026",
  "content": "Texte des statuts...",
  "version": "1.0",
  "is_active": true,
  "effective_date": "2026-01-01"
}
```

### 6.2 Élections

**`POST {{base_url}}/governance/elections/`**
```json
{
  "cycle": "{{cycle_id}}",
  "session": "{{session_id}}",
  "title": "Renouvellement bureau 2026",
  "method": "secret",
  "status": "planned",
  "date": "2026-01-15"
}
```

### 6.3 Candidats

**`POST {{base_url}}/governance/candidates/`**
```json
{
  "election": "uuid-election",
  "membership": "uuid-membership",
  "position": "uuid-position"
}
```

### 6.4 Votes

**`POST {{base_url}}/governance/votes/`**
```json
{
  "election": "uuid-election",
  "candidate": "uuid-candidat",
  "voter": null
}
```
*(voter=null pour scrutin secret)*

---

## 7. `apps.sanctions` — Sanctions

Base : `{{base_url}}/sanctions/`

### 7.1 Types de sanction

**`POST {{base_url}}/sanctions/types/`**
```json
{
  "name": "Retard",
  "slug": "retard",
  "description": "Arrivée en retard",
  "default_amount": 500,
  "is_fixed_amount": true,
  "is_automatic": false,
  "is_active": true
}
```

### 7.2 Sanctions

**`GET {{base_url}}/sanctions/sanctions/?status=pending&membership=<uuid>`**
**`POST {{base_url}}/sanctions/sanctions/`**
```json
{
  "sanction_type": "uuid-sanction-type",
  "membership": "uuid-membership",
  "session": "{{session_id}}",
  "amount": 500,
  "reason": "Arrivée à 18h30",
  "status": "pending"
}
```

---

## 8. `apps.events` — Événements

Base : `{{base_url}}/events/`

### 8.1 Événements

**`GET {{base_url}}/events/events/?event_type=ag&status=planned`**
**`POST {{base_url}}/events/events/`**
```json
{
  "title": "Assemblée générale 2026",
  "event_type": "ag",
  "description": "AG ordinaire",
  "date": "2026-03-15",
  "start_time": "10:00",
  "end_time": "13:00",
  "location": "Salle des fêtes",
  "status": "planned",
  "cycle": "{{cycle_id}}"
}
```

### 8.2 Présences événements

**`POST {{base_url}}/events/attendances/`**
```json
{
  "event": "uuid-event",
  "membership": "uuid-membership",
  "is_present": true,
  "notes": ""
}
```

---

## 9. `apps.subscriptions` — Abonnements SaaS

Base : `{{base_url}}/subscriptions/`

### 9.1 Liste des plans (public)

**`GET {{base_url}}/subscriptions/plans/`**

### 9.2 Mon abonnement

**`GET {{base_url}}/subscriptions/my-subscription/`**
Headers : `Authorization`, `X-Tenant`

### 9.3 Historique paiements

**`GET {{base_url}}/subscriptions/payments/`**

---

## 10. `apps.invitations` — Invitations

Base : `{{base_url}}/invitations/`

### 10.1 Envoyer une invitation

**`POST {{base_url}}/invitations/send/`**
```json
{
  "email": "nouveau@example.com",
  "phone": "+237690000099",
  "name": "Nouveau Membre",
  "role": "uuid-role",
  "channel": "email",
  "message": "Rejoins-nous !"
}
```

### 10.2 Vérifier une invitation

**`GET {{base_url}}/invitations/check/<token>/`** *(pas d'auth)*

### 10.3 Accepter (utilisateur existant)

**`POST {{base_url}}/invitations/accept/`** (Auth requise)
```json
{"token": "xxx-token-xxx"}
```

### 10.4 Inscription + acceptation

**`POST {{base_url}}/invitations/register-and-accept/`** *(pas d'auth)*
```json
{
  "token": "xxx-token-xxx",
  "telephone": "+237690000099",
  "first_name": "Nouveau",
  "last_name": "Membre",
  "email": "nouveau@example.com",
  "password": "mdp123456",
  "password_confirm": "mdp123456"
}
```

### 10.5 Login + acceptation

**`POST {{base_url}}/invitations/login-and-accept/`** *(pas d'auth)*
```json
{
  "token": "xxx-token-xxx",
  "telephone": "+237690000099",
  "password": "mdp123456"
}
```

### 10.6 Liste des invitations envoyées

**`GET {{base_url}}/invitations/list/?status=pending`**

---

## 11. `apps.notifications` — Notifications

Base : `{{base_url}}/notifications/`

### 11.1 Liste des notifications

**`GET {{base_url}}/notifications/?is_read=false&notification_type=loan_due`**

### 11.2 Marquer comme lues

**`POST {{base_url}}/notifications/mark_read/`**
```json
{"ids": ["uuid-notif-1", "uuid-notif-2"]}
```

### 11.3 Tout marquer comme lu

**`POST {{base_url}}/notifications/mark_all_read/`**

### 11.4 Compteur non lues

**`GET {{base_url}}/notifications/unread_count/`**

Réponse :
```json
{"count": 5}
```

### 11.5 Préférences

**`GET {{base_url}}/notifications/preferences/`**

**`PUT {{base_url}}/notifications/preferences/`**
```json
{
  "email_enabled": true,
  "sms_enabled": false,
  "whatsapp_enabled": true,
  "push_enabled": true,
  "muted_types": ["new_message"],
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00"
}
```

---

## 12. `apps.chat` — Chat

Base : `{{base_url}}/chat/`

### 12.1 Créer une conversation privée (1:1)

**`POST {{base_url}}/chat/conversations/private/`**
```json
{"member_id": "uuid-membership-cible"}
```

### 12.2 Créer une conversation de groupe

**`POST {{base_url}}/chat/conversations/group/`**
```json
{
  "name": "Bureau 2026",
  "description": "Canal du bureau",
  "member_ids": ["uuid-m1", "uuid-m2", "uuid-m3"]
}
```

### 12.3 Liste des conversations

**`GET {{base_url}}/chat/conversations/`**

### 12.4 Détail d'une conversation

**`GET {{base_url}}/chat/conversations/{id}/`**

### 12.5 Messages d'une conversation

**`GET {{base_url}}/chat/conversations/{id}/messages/`**

### 12.6 Envoyer un message

**`POST {{base_url}}/chat/conversations/{id}/send/`**
```json
{
  "content": "Bonjour à tous !",
  "message_type": "text",
  "reply_to": null,
  "attachments": []
}
```

### 12.7 Marquer comme lu

**`POST {{base_url}}/chat/conversations/{id}/read/`**

### 12.8 WebSocket (hors Postman HTTP)

```
ws://localhost:8010/ws/chat/{conversation_id}/?token={{access_token}}
```

Messages :
```json
{"type": "chat.message", "content": "Salut", "message_type": "text"}
{"type": "chat.typing"}
{"type": "chat.read"}
{"type": "jitsi.start_session"}
```

Voir [CHAT_API_EXAMPLES.md](CHAT_API_EXAMPLES.md) pour plus de détails.

---

## Workflow de test complet (scénario E2E)

Ordonnancement recommandé pour dérouler un test complet :

### Phase 1 — Onboarding
1. `POST /auth/register/` → token
2. `POST /auth/valid-otp/`
3. `POST /associations/associations/create/` → slug
4. `POST /associations/associations/select/`

### Phase 2 — Configuration
5. `POST /tontines/types/` → créer une tontine
6. `POST /members/roles/` → créer rôles custom
7. `POST /invitations/send/` → inviter des membres
8. `POST /cycles/cycles/` → créer cycle
9. `POST /cycles/configs/` → config tontine du cycle

### Phase 3 — Souscriptions
10. `POST /tontines/subscriptions/` → chaque membre souscrit

### Phase 4 — Séance
11. `POST /cycles/sessions/` → créer séance
12. `POST /cycles/attendances/` → marquer présences
13. `POST /cycles/sessions/{id}/open-pot/` → ouvrir pot
14. `POST /finance/contributions/` → enregistrer cotisations
15. `POST /cycles/pots/{id}/auction/` ou `/distribute/`
16. `POST /cycles/pots/{id}/close/`

### Phase 5 — Suivi
17. `GET /finance/transactions/` → vérifier écritures
18. `GET /notifications/` → vérifier notifs générées
19. `GET /cycles/payouts/` → bénéficiaires

---

## Annexes

### Gestion des fichiers (upload)

Pour `logo`, `avatar`, `file` (documents) : utiliser **multipart/form-data** dans Postman.

| Key | Type |
|-----|------|
| name | Text |
| logo | **File** (bouton « File ») |

Ne pas envoyer `Content-Type: application/json` dans ce cas — Postman gère le multipart automatiquement.

### Pagination

Toutes les listes paginées :
- `?page=2` — page suivante
- `?page_size=50` *(si autorisé par le backend)*

Réponse standard :
```json
{
  "count": 120,
  "next": "http://.../api/xxx/?page=3",
  "previous": "http://.../api/xxx/?page=1",
  "results": [...]
}
```

### Filtres & recherche

- `?search=<text>` — recherche full-text sur les champs indexés
- `?ordering=<field>` ou `?ordering=-<field>` (desc)
- Filtres spécifiques selon chaque app (voir sections ci-dessus)

### Documentation interactive

Swagger UI : `http://localhost:8010/swagger/`
ReDoc : `http://localhost:8010/redoc/`
Schema JSON : `http://localhost:8010/swagger.json`

---

*Documentation générée le 2026-04-21. Pour toute évolution d'endpoint, se référer au code source ou à Swagger.*
