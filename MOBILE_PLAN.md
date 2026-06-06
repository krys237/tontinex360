# TontineX360 — Plan de développement de l'application mobile

> Document de référence généré à partir de l'analyse croisée du **backend Django** (`tontine_project/`), du **frontend Next.js** (`tontinex_front/.../src/`), de la documentation et du `.pptx`.
> Le **code est la source de vérité** ; les points où la doc/le `.pptx` sont obsolètes sont signalés dans la section « À confirmer ».

---

## 0. Fondations techniques (à reproduire à l'identique sur mobile)

### Client HTTP
- **Base URL (production)** : `https://api.tontinex360.com/api` (via `NEXT_PUBLIC_API_URL`). L'URL `tontine-project.onrender.com` trouvée dans le code = dev/staging.
- **Front prod** : `https://app.tontinex360.com` · **Swagger** : `https://api.tontinex360.com/swagger/` · **ReDoc** : `.../redoc/`
- **WebSocket (prod)** : `wss://api.tontinex360.com/ws/` (chat + notifications live)
- **Auth** : `Authorization: Bearer <access_token>`
- **Multi-tenant** : header **`X-Tenant: <association_slug>`** sur chaque requête (⚠️ le `.pptx` disait `X-Association-Slug` — **obsolète**, le code utilise `X-Tenant`)
- **Refresh 401** : sur 401, POST `/auth/token/refresh/` `{ refresh }` → `{ access }`, on rejoue la requête. Échec → purge tokens + retour login.
- **Pagination DRF** : réponses `{ count, results, next, previous }` → déballer `results`. Prévoir un helper `unwrap()`.
- **Stockage** : tokens + slug d'association active. Sur mobile → **secure storage** (Keychain / Keystore), pas un simple localStorage.

### Auth (flux)
`register` → `valid-otp` (OTP téléphone WhatsApp/SMS/email) → `login` → JWT (access ~2h / refresh ~7j). Backend custom = login par **téléphone** (pas email).

### Permissions / Navigation (à reproduire)
- Permissions au format `app.action` avec wildcards `*` et `app.*`.
- Helpers : `can()`, `canAny()`, `canAll()`, `isBureau`, `isPresident`, `isLambda`.
- **Landing après login** : Président → `/dashboard` ; admin finance → `/finance/contributions` ; admin membres → `/members` ; autre bureau → `/dashboard` ; **membre lambda → `/wallets/me`**.
- Deux espaces de navigation : **« Pilotage »** (bureau) et **« Mon espace »** (perso, tous membres).
- Un `User` peut appartenir à **N associations** → switcher d'association + refresh du membership.

### Temps réel
- **Chat** : WebSocket `wss://<host>/ws/chat/<conversation_id>/?token=<JWT>` (Django Channels) + **fallback polling REST 2,5 s**. Jitsi pour la visio.
- **Enchères** : polling `bids` toutes les **8 s** (pas de WS).
- **Sondages** : polling 10 s quand le sondage est ouvert.
- **Push** : FCM (`/auth/register-fcm-token/`), best-effort en complément du in-app.

---

## 1. Ordre de construction (phases)

| Phase | Modules | Pourquoi à ce moment |
|---|---|---|
| **0 — Socle** | client HTTP, auth store, navigation+permissions, push FCM | Pré-requis de tout le reste, pas d'écran « métier » |
| **1 — Auth & Onboarding** | auth, invitations, associations-core | Porte d'entrée ; rien n'est accessible sans association active |
| **2 — Cœur membre** | dashboard, members | Écran d'atterrissage + annuaire, base de presque tous les écrans |
| **3 — Tontines & Séances** | tontines, cycles-sessions | Cœur métier : cotisations, cagnotte, enchères, versements |
| **4 — Finance & Wallets** | finance, wallets | Argent : cotisations, prêts, trésorerie, soldes virtuels |
| **5 — Gouvernance & contrôle** | approvals, proxies, governance, sanctions, events | Workflows bureau, votes, procurations, calendrier |
| **6 — Communication** | notifications, chat | Engagement, temps réel |
| **7 — Abonnement** | subscriptions | Billing SaaS (président) |

> Les phases 5–7 sont relativement indépendantes : l'ordre peut être ajusté selon tes priorités produit.

---

## 2. Carte détaillée par module (API ↔ écran)

### Phase 1 — Auth & Onboarding

#### Module `auth` — priorité HAUTE
**Écrans** : `/login`, `/register`, `/verify-otp`, `/forbidden`
**Endpoints clés** : `POST /auth/register/`, `POST /auth/login/`, `POST /auth/valid-otp/`, `POST /auth/resend-otp/`, `POST /auth/token/refresh/`, `POST /auth/change-fogot-password/` *(typo « fogot » dans l'URL — voir À confirmer)*, `POST /auth/change-password/`, `GET/PATCH /auth/me/`, `POST /auth/register-fcm-token/`

#### Module `invitations` — priorité HAUTE
**Écrans** : `/invite/[token]` (public), `/members/invite`, `/members/invitations`
**Endpoints** : `GET /invitations/check/{token}`, `POST /invitations/register-and-accept/`, `POST /invitations/login-and-accept/`, `POST /invitations/accept/`, `POST /invitations/send/`, `GET /invitations/list/`

#### Module `associations-core` — priorité HAUTE
**Écrans** : `/associations/create`, `/no-association`, `/settings/association`, `/settings/roles`, `/settings`, `/settings/profile`
**Endpoints** : `GET /associations/associations/`, `POST .../create/`, `POST .../select/`, `GET/PATCH .../{slug}/`, `GET/POST/PATCH/DELETE /members/roles/`, `GET/PATCH /auth/me/`

### Phase 2 — Cœur membre

#### Module `dashboard` — priorité HAUTE
**Écran** : `/dashboard` — **2 vues** : carte membre (wallet, souscriptions, versements, prochaine séance) vs bureau (KPI association : membres actifs, trésorerie, cycles, séances, invitations en attente).
**Agrège** : `membersApi.list`, `sessionsApi.list`, `financeApi.treasury`, `tontinesApi.types`, `tontinesApi.subscriptions`, `cyclesApi.list`, `invitationsApi.list`, `walletsApi.myWallet`, `potsApi.payouts`

#### Module `members` — priorité HAUTE
**Écrans** : `/members`, `/members/[id]`, `/members/bureau`, `/members/fees-overview`, `/members/import`, `/members/requests`, `/members/resignations`
**Endpoints** : `memberships/` (CRUD + `/signature/`), `roles/`, `bureau-positions/`, `bureau-members/`, `membership-requests/` (+ approve/reject/cancel), `resignations/` (+ approve/reject/cancel), `fees/` (+ config, record, by-membership, pending-overview), `imports/` (preview, import, template)

### Phase 3 — Tontines & Séances

#### Module `tontines` — priorité HAUTE
**Écrans** : `/tontines` (bureau : types & cycles), `/tontines/me` (membre : souscrire + cotiser)
**Endpoints** : `GET/POST/PATCH/DELETE /tontines/types/`, `GET/POST/PATCH/DELETE /tontines/subscriptions/`

#### Module `cycles-sessions` — priorité HAUTE
**Écrans** : `/sessions`, `/sessions/[id]` (onglets Présences / Cagnottes), `/sessions/create`, `/my-payouts`, `/auctions`
**Endpoints** : `cycles/` (+ preview-dates, generate-sessions, sessions-stats), `configs/`, `sessions/` (+ open-pot), `attendances/`, `pots/` (+ distribute, auction, close), `payouts/` (+ sign_receipt), `bids/` (polling 8 s), `session-reports/` (CRUD backend mais **pas encore d'UI**)
**Note** : clôture de cycle / annulation de séance = **approbation Tier 4** (module approvals).

### Phase 4 — Finance & Wallets

#### Module `finance` — priorité HAUTE
**Écrans** : `/finance`, `/finance/contributions`, `/finance/loans`, `/finance/transactions`, `/finance/correction-requests`, `/finance/tontine-balances/[id]`, `/pot`
**Endpoints** : `contributions/` (+ sign_receipt, request-correction), `correction-requests/` (approve/reject/cancel, TTL 24 h), `loans/`, `loan-repayments/` (+ sign_receipt), `treasury/`, `transactions/` (lecture seule), `tontine-balances/`
**Note** : modifs de champs protégés (montant prêt, statut) → passent par le **workflow d'approbation**.

#### Module `wallets` — priorité HAUTE
**Écrans** : `/wallets/me` (membre), `/wallets` (bureau : liste + settlement de cycle)
**Endpoints** : `me/` (+ entries, summary), `wallets/` (+ entries, recompute), `manual-adjustment/` (→ approbation), `cycle-settlement/`

### Phase 5 — Gouvernance & contrôle

#### Module `approvals` — priorité HAUTE (transversal)
**Écran** : `/approvals`
**Endpoints** : `GET /approvals/`, `GET /approvals/handlers/`, `POST /approvals/request/`, `POST /approvals/{id}/approve|reject|cancel/`
**Concept** : multi-signature, double (Tier 1-3) ou triple (Tier 4 : président + 2 membres bureau), TTL 24 h. Déclenché par finance, members, cycles, governance, sanctions, wallets.

#### Module `proxies` — priorité HAUTE
**Écran** : `/proxies` (3 onglets : Mes procurations / Reçues / À approuver)
**Endpoints** : `GET/POST/PATCH/DELETE /proxies/`, `POST /proxies/{id}/approve|reject|cancel/`, `GET /proxies/active/`

#### Module `governance` — priorité HAUTE
**Écrans** : `/governance/elections`, `/governance/elections/[id]`, `/governance/polls`, `/governance/polls/[id]`, `/governance/documents`, `/announcements`
**Endpoints** : `documents/`, `elections/` (+ candidates, bulk-save-results), `votes/`, `polls/` (+ open, close, vote, results), `announcements/` (+ mark_read, unread_count)

#### Module `sanctions` — priorité BASSE (surtout desktop/bureau)
**Écran** : `/sanctions` (onglets : sanctions appliquées / types)
**Endpoints** : `types/`, `sanctions/` (+ sign_receipt). Champs montant/statut → approbation.

#### Module `events` — priorité HAUTE
**Écran** : `/events`
**Endpoints** : `events/` (+ resync-attendances), `attendances/`

### Phase 6 — Communication

#### Module `notifications` — priorité HAUTE
**Écran** : `/notifications` (+ badge non-lus dans la nav)
**Endpoints** : `GET /notifications/`, `unread_count/`, `mark_read/`, `mark_all_read/`, `GET/PUT /notifications/preferences/`
**Note** : écran de préférences **absent du front web** (API existe). Sur mobile c'est l'occasion de le faire.

#### Module `chat` — priorité HAUTE
**Écran** : `/chat`
**Endpoints REST** : `conversations/`, `{id}/messages/`, `{id}/send/`, `{id}/read/`, `conversations/private|group|general/`
**Temps réel** : WebSocket + fallback polling 2,5 s. Types prévus backend (image/file/voice, typing, read receipts, Jitsi) **pas encore branchés côté UI**.

### Phase 7 — Abonnement

#### Module `subscriptions` — priorité HAUTE (président)
**Écran** : `/settings/subscription` (+ `/settings/membership-fees`, qui relève en réalité de `members`)
**Endpoints utilisés** : `plans/`, `my-subscription/`, `payments/`
**Endpoints backend non branchés au front** : `recommended-plan/`, `change-plan/`, `payments/initiate/`, `payments/{id}/confirm/`, `cancel/`

---

## 3. À confirmer / incohérences détectées (le code prime sur la doc)

1. **Header tenant** = `X-Tenant` (et non `X-Association-Slug` du `.pptx`). ✅ confirmé par `client.ts`.
2. **Bug backend OTP** : `views.py` fait `user.active = True` alors que le champ est `is_active` → risque de crash à la validation OTP. À corriger.
3. **Typo URL** : `/auth/change-fogot-password/` (« fogot »). Front et back alignés sur la typo, mais à nettoyer.
4. **Invitations** : le front lit `user_exists` / `status`, le back renvoie `has_existing_account` / `invitation` imbriqué. Mapping de champs à vérifier.
5. **Subscriptions** : le front affiche `max_tontine_types` / `max_cycles` qui **n'existent pas** dans le serializer (seuls `max_members`, `max_monthly_cagnotte`). 5 endpoints d'action non branchés.
6. **Notifications** : delivery SMS/email/WhatsApp = TODO (seul in-app fonctionne) ; `quiet_hours` et `muted_types` partiellement ignorés ; chemin credential Firebase **codé en dur** et inexistant (`firebase.py`) → crash potentiel push.
7. **Chat** : code mort dans `consumers.py` (lignes ~541-790) ; types `bureau`/`session` non branchés ; UI image/file/voice/typing/Jitsi absente.
8. **Cycles** : enum `AcquisitionMethod` incohérent entre `views.py` (SCHEDULED…) et `models.py` (RANDOM/SEQUENTIAL…). `session-reports` et leurs pièces jointes : API complète mais **aucune UI**.
9. **Permissions** : catalogue de permissions **codé en dur** côté front (pas d'endpoint `/members/permissions/`). À synchroniser manuellement.
10. **Sécurité** : protection middleware Next minimale (tokens en localStorage). Sur mobile → secure storage obligatoire.

---

## 4. Processus de travail (par module)

Pour chaque module pris dans l'ordre des phases :
1. Je liste les **écrans précis** dont j'ai besoin (routes ci-dessus) + où les voir sur le web.
2. Tu me fournis les **maquettes Figma** correspondantes.
3. J'intègre l'écran en réutilisant les endpoints + conventions du socle (Phase 0).
4. On valide, puis on enchaîne.
