# Subscriptions & Onboarding — Documentation API

> Base URL : `http://localhost:8000` (dev) — adapte selon ton environnement.

---

## Sommaire

1. [Vue d'ensemble du flux](#vue-densemble-du-flux)
2. [Authentification & headers](#authentification--headers)
3. [Modèles de données](#modèles-de-données)
4. [Endpoints d'inscription / association](#endpoints-dinscription--association)
5. [Endpoints subscriptions](#endpoints-subscriptions)
6. [Codes d'erreur](#codes-derreur)
7. [Tâches Celery & événements](#tâches-celery--événements)

---

## Vue d'ensemble du flux

```
┌──────────────────┐
│ 1. Inscription   │  POST /api/auth/register/
│    utilisateur   │  → User créé (is_active=False), OTP envoyé, JWT retourné
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Validation    │  POST /api/auth/valid-otp/
│    OTP           │  → User.is_active = True
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Création      │  POST /api/associations/create/
│    association   │  → Subscription auto-créée (plan=famille, trial 90j)
└────────┬─────────┘  → Membership fondateur, rôle Président, défauts (rôles, sanctions, caisse)
         │
         ▼
┌──────────────────┐
│ 4. Trial 90 j    │  Toutes les fonctionnalités débloquées
│                  │  Notification 3 jours avant fin (J-3)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. Fin de trial  │  Notification automatique avec plan recommandé
│                  │  basé sur cagnotte mensuelle moyenne + nb membres
└────────┬─────────┘  GET /api/subscriptions/recommended-plan/
         │
         ▼
┌──────────────────┐
│ 6. Choix &       │  POST /api/subscriptions/change-plan/
│    paiement      │  POST /api/subscriptions/payments/initiate/
│                  │  POST /api/subscriptions/payments/<id>/confirm/
└────────┬─────────┘  → Subscription = ACTIVE, période courante calculée
         │
         ▼
┌──────────────────┐
│ 7. Renouvellement│  Tâche Celery J-3 → crée Payment pending
│    automatique   │  Notification au président → confirme paiement
└──────────────────┘
```

### Arbre de décision — recommandation de plan

| Cagnotte mensuelle moyenne (90j) | OU | Membres actifs | → Plan | Prix/mois |
|---|---|---|---|---|
| ≥ 50 000 000 XAF | OU | > 100 | **Président** | 75 000 |
| ≥ 30 000 000 XAF | OU | > 50  | **VIP**       | 50 000 |
| ≥ 1 000 000 XAF  | OU | > 30  | **Pro**       | 25 000 |
| ≥ 250 000 XAF    | OU | > 15  | **Quartier**  | 7 500  |
| ≥ 100 000 XAF    | OU | > 10  | **Village**   | 4 000  |
| sinon            |    |       | **Famille**   | 3 000  |

> **Note** : le critère le plus contraignant gagne (OR logique). Les seuils sont définis dans `apps/subscriptions/services.py:TIER_THRESHOLDS`.

---

## Authentification & headers

### Headers requis pour les endpoints authentifiés

| Header | Valeur | Quand |
|---|---|---|
| `Authorization` | `Bearer <access_token>` | Tous les endpoints sauf `register`, `login`, `plans/` |
| `X-Tenant` | `<association_slug>` | Tous les endpoints liés à une association (subscriptions, members, etc.) |
| `Content-Type` | `application/json` | Requêtes POST/PUT/PATCH |

### Obtenir un access token

```http
POST /api/auth/login/
Content-Type: application/json

{
  "telephone": "+237600000000",
  "password": "monMotDePasse"
}
```

**Réponse 200** :
```json
{
  "user": {
    "id": "uuid",
    "telephone": "+237600000000",
    "first_name": "Jean",
    "last_name": "Dupont",
    "email": "jean@example.com",
    "associations": [...]
  },
  "tokens": {
    "refresh": "eyJ...",
    "access": "eyJ..."
  }
}
```

### Refresh

```http
POST /api/auth/token/refresh/
Content-Type: application/json

{ "refresh": "eyJ..." }
```

---

## Modèles de données

### Plan

```json
{
  "id": "uuid",
  "name": "Quartier",
  "slug": "quartier",
  "description": "Pour les tontines de quartier...",
  "price_monthly": "7500.00",
  "price_yearly": "75000.00",
  "currency": "XAF",
  "max_members": 30,
  "max_monthly_cagnotte": "1000000.00",
  "is_unlimited_members": false,
  "is_unlimited_cagnotte": false,
  "trial_days": 90,
  "display_order": 2
}
```

> `max_members = 0` ou `max_monthly_cagnotte = 0` signifie **illimité**.

### Subscription

```json
{
  "id": "uuid",
  "plan": { /* Plan complet */ },
  "status": "trialing | active | past_due | cancelled | expired | suspended",
  "billing_cycle": "monthly | yearly",
  "trial_start": "2026-04-28T10:00:00Z",
  "trial_end":   "2026-07-27T10:00:00Z",
  "current_period_start": null,
  "current_period_end":   null,
  "auto_renew": true,
  "cancelled_at": null,
  "is_usable": true
}
```

### Payment

```json
{
  "id": "uuid",
  "subscription": "uuid",
  "amount": "7500.00",
  "currency": "XAF",
  "status": "pending | completed | failed | refunded",
  "payment_method": "mobile_money | card | bank_transfer | cash",
  "provider_reference": "MTN-1234567890",
  "description": "Abonnement Quartier (monthly)",
  "paid_at": null,
  "period_start": "2026-07-27T10:00:00Z",
  "period_end":   "2026-08-26T10:00:00Z",
  "created_at":   "2026-07-25T08:00:00Z"
}
```

---

## Endpoints d'inscription / association

### 1. Inscription utilisateur

```http
POST /api/auth/register/
Content-Type: application/json

{
  "telephone": "+237600000000",
  "first_name": "Jean",
  "last_name": "Dupont",
  "email": "jean@example.com",
  "password": "secret1234",
  "password_confirm": "secret1234"
}
```

**201 Created** :
```json
{
  "user": { "id": "uuid", "telephone": "+237600000000", ... },
  "tokens": { "refresh": "eyJ...", "access": "eyJ..." }
}
```

> Un OTP est envoyé par SMS au numéro fourni. Le compte est inactif tant que l'OTP n'est pas validé.

### 2. Validation de l'OTP

```http
POST /api/auth/valid-otp/
Content-Type: application/json

{
  "telephone": "+237600000000",
  "otp": "123456"
}
```

**200 OK** : `{ "status": true, "error": "OTP matched..." }`

### 3. Création d'association

```http
POST /api/associations/create/
Authorization: Bearer <access>
Content-Type: application/json

{
  "name": "Tontine des Jeunes de Banka",
  "slug": "jeunes-banka",
  "description": "Tontine mensuelle entre jeunes",
  "city": "Banka",
  "region": "Ouest"
}
```

**201 Created** :
```json
{
  "association": { "id": "uuid", "name": "...", "slug": "jeunes-banka", ... },
  "membership_id": "uuid",
  "subscription_status": "trialing",
  "trial_end": "2026-07-27T10:00:00Z"
}
```

> ✅ Side effects :
> - `Subscription` créée avec plan `famille`, trial 90 jours
> - `Membership` fondateur avec rôle `Fondateur` (permissions `*`)
> - `BureauMember` président
> - Rôles, positions de bureau, types de sanctions, caisse principale créés par signal

---

## Endpoints subscriptions

> Préfixe commun : `/api/subscriptions/`
> Header `X-Tenant: <slug>` requis sur tous (sauf `plans/`).

### `GET /plans/` — Liste des plans (public)

```http
GET /api/subscriptions/plans/
```

**200 OK** : `{ "count": 6, "results": [ Plan, Plan, ... ] }`

> Pas d'auth requise. Pratique pour la page tarification.

---

### `GET /my-subscription/` — Mon abonnement

```http
GET /api/subscriptions/my-subscription/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
```

**200 OK** : `Subscription`

**404** si pas d'abonnement / pas d'association sélectionnée.

---

### `GET /recommended-plan/` — Plan recommandé (Mesure 90 jours)

```http
GET /api/subscriptions/recommended-plan/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
```

**200 OK** :
```json
{
  "recommended_plan": { /* Plan complet */ },
  "metrics": {
    "monthly_cagnotte": "480000.00",
    "members_count": 18,
    "window_days": 90
  }
}
```

> ⚙️ Calcul : agrège `SessionPot.total_collected` sur les 90 derniers jours, divise par 3 (≈ moyenne mensuelle). Le tier est déterminé par le critère le plus contraignant entre cagnotte et membres.

---

### `GET /payments/` — Historique paiements

```http
GET /api/subscriptions/payments/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
```

**200 OK** : liste paginée de `Payment`.

---

### `POST /change-plan/` — Upgrade / downgrade

> 🔒 Réservé au président (rôle `fondateur`/`president` ou permissions `*` / `subscription.manage`).

```http
POST /api/subscriptions/change-plan/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
Content-Type: application/json

{
  "plan_slug": "quartier",
  "billing_cycle": "monthly"   // "monthly" ou "yearly", défaut: monthly
}
```

**200 OK** : `Subscription` (avec le nouveau plan).

> Le changement n'a pas d'impact sur la période en cours. Si l'abonnement est en trial, le trial reste actif. Si actif, le nouveau plan s'applique au prochain renouvellement (paiement déjà effectué non remboursé).

**Erreurs** :
- `400` `{"plan_slug": ["Plan introuvable ou inactif."]}`
- `403` Non-président

---

### `POST /payments/initiate/` — Initialiser un paiement

> 🔒 Réservé au président.

```http
POST /api/subscriptions/payments/initiate/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
Content-Type: application/json

{
  "billing_cycle": "monthly",
  "payment_method": "mobile_money"
}
```

**201 Created** : `Payment` en `pending`, avec `period_start` / `period_end` calculés.

> Le `period_start` :
> - Si `current_period_end` est dans le futur (renouvellement) → starts à la fin de la période courante
> - Sinon → starts maintenant (premier paiement, post-trial)

---

### `POST /payments/<uuid>/confirm/` — Confirmer un paiement

> 🔒 Réservé au président.
> ⚠️ **Endpoint manuel temporaire** — sera remplacé par un webhook quand le hub de paiement sera intégré.

```http
POST /api/subscriptions/payments/9f8b...uuid/confirm/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
Content-Type: application/json

{
  "provider_reference": "MTN-1234567890"  // optionnel
}
```

**200 OK** :
```json
{
  "payment": {
    "status": "completed",
    "paid_at": "2026-07-25T08:30:00Z",
    "provider_reference": "MTN-1234567890",
    ...
  },
  "subscription": {
    "status": "active",
    "current_period_start": "2026-07-27T10:00:00Z",
    "current_period_end":   "2026-08-26T10:00:00Z",
    ...
  }
}
```

> ✅ Side effect : signal `post_save` sur `Payment` → `SubscriptionService.activate_from_payment()` → `status=active`, `current_period_*` calé sur le paiement.

**Erreurs** :
- `400` Paiement déjà en statut `completed` / `refunded`
- `404` Paiement introuvable ou n'appartient pas à cette association

---

### `POST /cancel/` — Annuler le renouvellement automatique

> 🔒 Réservé au président.

```http
POST /api/subscriptions/cancel/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
```

**200 OK** : `Subscription` avec `auto_renew: false`, `cancelled_at` renseigné.

> L'abonnement reste utilisable jusqu'à `current_period_end`. Pas de remboursement.

---

## Codes d'erreur

| Code | Signification | Exemple |
|---|---|---|
| **400** | Validation | `{"plan_slug": ["Plan introuvable ou inactif."]}` |
| **401** | Non authentifié | `{"detail": "Authentication credentials were not provided."}` |
| **402** | Abonnement expiré (middleware) | `{"error": "subscription_expired", "message": "...", "plan_status": "expired"}` |
| **403** | Permission refusée | `{"detail": "Seul le president peut gerer l'abonnement..."}` |
| **404** | Ressource introuvable | `{"detail": "Pas d'abonnement pour cette association."}` |

> Le `SubscriptionMiddleware` ([common/middleware.py:61](common/middleware.py#L61)) bloque automatiquement les requêtes en **402** quand `Subscription.is_usable == False`, sauf paths exemptés (`/api/auth/`, `/api/subscriptions/`, `/api/associations/`, `/admin/`, `/api/invitations/accept/`).

---

## Tâches Celery & événements

| Tâche | Schedule | Action |
|---|---|---|
| `apps.notifications.tasks.check_expiring_trials` | 09h00 quotidien | J-3 fin trial → notif `trial_expiring` au président |
| `apps.subscriptions.tasks.expire_overdue_subscriptions` | 00h30 quotidien | Trials/abos expirés → `expired` + **notif fin de trial avec recommandation** |
| `apps.subscriptions.tasks.auto_renew_subscriptions` | 02h00 quotidien | J-3 fin période → crée `Payment` pending + notif `subscription_renewal_pending` |
| `apps.subscriptions.tasks.evaluate_subscription_tier` | Lundi 03h00 | Compare tier actuel vs recommandé → notif `subscription_tier_recommended` si différent |

### Types de notification émis

| Type | Quand | Payload `data` |
|---|---|---|
| `trial_expiring` | 3 jours avant fin trial | `subscription_id`, `days_left`, `plan_name` |
| `trial_ended_recommendation` | Fin du trial | `subscription_id`, `recommended_plan_slug`, `recommended_plan_name`, `recommended_price_monthly`, `currency`, `monthly_cagnotte`, `members_count`, `window_days` |
| `subscription_expired` | Fin période payée | `subscription_id`, `plan_name`, `sub_type` |
| `subscription_renewal_pending` | Renouvellement auto | `subscription_id` |
| `subscription_tier_recommended` | Lundi 03h si tier différent | `subscription_id`, `recommended_plan_slug`, `monthly_cagnotte`, `members_count` |

---

## Limites & restrictions (préparées, non appliquées)

Le modèle prépare deux types de restrictions, mais elles ne sont **pas encore enforcées** dans le code métier (à activer plus tard) :

- `Subscription.check_member_limit()` — vérifie qu'on ne dépasse pas `plan.max_members`
- `Subscription.check_cagnotte_limit(amount)` — vérifie qu'un montant mensuel ne dépasse pas `plan.max_monthly_cagnotte`

> ✅ Déjà appelé : `Subscription.check_member_limit()` est utilisé dans `apps/invitations/services.py` au moment d'inviter un nouveau membre.
