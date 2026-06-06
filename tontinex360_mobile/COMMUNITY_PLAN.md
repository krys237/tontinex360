# Module Communauté — Schéma d'implémentation (mobile)

> Source de vérité : **code backend** (`tontine_project/apps/*`) + front web de référence
> (`tontinex_front/.../src`). Issu de l'exploration croisée du 2026-06-04.
> Périmètre membre : **Fil des annonces · Chat de groupe · Votes · Espace membre (perso)**.

## Conventions (rappel)
- Base URL REST : `API_URL` = `https://tontine-project.onrender.com/api` *(override temporaire — `api.tontinex360.com` en panne REST)*. Le préfixe `/api` est déjà inclus.
- WebSocket : `WS_URL` = `wss://api.tontinex360.com/ws` *(inchangé)*.
- Auth : `Authorization: Bearer <access>` + refresh 401 sur `/auth/token/refresh/`.
- Multi-tenant : header **`X-Tenant: <association_slug>`** sur tout `/governance/*`, `/chat/*`, `/members/*`. **Pas** sur `/auth/me/`, `/auth/associations/`.
- Pagination DRF : `{count, results, next, previous}` → `unwrap()`.

## ⚠️ Alertes transverses
1. **Permissions backend laxistes** — `governance` & `members` n'exigent que `IsMember`. Create/update/delete d'annonces, sondages, memberships ne sont **pas** gardés par rôle au backend. Le gating « bureau/président » est **UI-only** (`canManage`). Reproduire le gating côté mobile, mais ne pas s'y fier pour la sécurité. → signaler au backend pour durcissement.
2. **Host WS ≠ host REST actuellement** — REST sur Render, WS sur `api.tontinex360.com`. Vérifier que le WS chat est bien servi sur ce host, sinon socket `offline` permanent → fallback polling.
3. **Docs chat trompeuses** — `CHAT_API_EXAMPLES.md` / `CHAT_URLS_CONFIGURATION.md` décrivent `/api/v1/conversations/`, `mark_as_read/`, `mute/`… **inexistants**. Code réel = `/api/chat/`, routes `/messages/ /send/ /read/` + `/private/ /group/ /general/`. **Se fier au code.**

---

## 1. Fil des annonces  🟡 (partiel)
**Backend** : `governance` — `Announcement` (title, content, priority, audience, is_pinned, attachment, author_name, `is_read`) + `AnnouncementReadStatus`. Pas de WS.

| Méthode | Route | Usage |
|---|---|---|
| GET | `/governance/announcements/?active_only=true` | fil (épinglées en tête) |
| GET | `/governance/announcements/{id}/` | détail (`is_read` calculé) |
| POST | `/governance/announcements/{id}/mark_read/` | marquer lue (idempotent) |
| GET | `/governance/announcements/unread_count/` | badge non-lues |
| POST/PATCH/DELETE | `/governance/announcements/[{id}/]` | *(bureau, UI-gated)* CRUD |

**Workflow membre** : ouvre Fil → liste · badge non-lues → `unread_count` · ouvre une annonce → détail · à l'ouverture/scroll → `mark_read` + refetch · pièce jointe → download URL `attachment`.

**Mobile** :
- Déjà : `governanceApi.announcements()`, `markAnnouncementRead()`, onglet Fil (liste).
- À faire : `unreadCount()` dans `lib/api/governance.ts` ; appel `mark_read` à l'ouverture ; `AnnouncementDetailScreen` ; gestion `attachment` ; pull-to-refresh (déjà là).

---

## 2. Chat de groupe  🔴 (à faire — gros morceau)
**Backend** : `chat` — `Conversation` (conv_type `group`/`general`/`private`/`bureau`/`session`), `ConversationMember` (unread_count, last_read_at, role), `Message` (content, message_type, reply_to, attachments).

**REST** (`Bearer` + `X-Tenant`) :
| Méthode | Route | Usage |
|---|---|---|
| GET | `/chat/conversations/` | mes conversations |
| GET | `/chat/conversations/{id}/messages/` | 50 derniers msg (**pas de pagination**) |
| POST | `/chat/conversations/{id}/send/` | envoyer (fallback REST) |
| POST | `/chat/conversations/{id}/read/` | marquer lue (route réelle `/read/`) |
| POST | `/chat/conversations/general/` | récupérer/créer le canal général |
| POST | `/chat/conversations/group/` | *(bureau)* créer groupe `{name, member_ids[]}` |
| POST | `/chat/conversations/private/` | conversation 1-à-1 |

**WebSocket** : `wss://<host>/ws/chat/{id}/?token={JWT}` (pas de `X-Tenant`, asso déduite de la conv).
- → `chat.message` `{content, message_type?, reply_to?, attachments?}` · `chat.typing` `{is_typing}` · `chat.read` `{message_ids[]}`
- ← `chat.message` `{data:Message}` · `chat.typing` `{data:{user_id,user_name,is_typing}}` · `chat.messages.read` `{data:{user_id,message_ids}}`
- Close codes : `4001` token, `4004` introuvable, `4403` pas membre.

**Workflow membre** : ouvre Chat → `conversations/` + `conversations/general/` · sélectionne → `messages/` · ouvre WS (sinon polling REST ~2,5 s) · écrit → WS `chat.message`, si `send()→false` → POST `send/` · frappe → `chat.typing` · à l'ouverture → POST `read/` · *(bureau)* crée groupe → POST `group/`.

**Mobile** :
- Déjà : `lib/ws/use-chat-socket.ts` (hook WS + fallback via `send()→false`).
- À créer : `lib/api/chat.ts`, `lib/types/chat.ts`, écran **liste conversations**, écran **conversation** (messages + input + typing + read).
- Limites backend : pas de pagination (50 msg, pas de scroll-historique), pas de mute/épingler/supprimer-message REST, création groupe réservée bureau (403), filtrer les `message_type='system'` (a rejoint/quitté).

---

## 3. Votes (sondages)  🟡 (partiel)
**Backend** : `governance` — `Poll` (kind `single_choice`/`multi_choice`, status, is_anonymous, allow_change_vote, max_choices, results_visible_before_close, `has_voted`, `is_open_now`) + `PollOption` + `PollVote`. Pas de WS (polling 10 s).
> Les `Election` ne sont **pas** un parcours de vote en ligne membre (résultats saisis en bloc par le bureau) → hors scope « Votes membre ».

| Méthode | Route | Usage |
|---|---|---|
| GET | `/governance/polls/?status=open` | liste |
| GET | `/governance/polls/{id}/` | détail + options |
| POST | `/governance/polls/{id}/vote/` | **voter** `{option_ids:[...]}` |
| GET | `/governance/polls/{id}/results/` | résultats agrégés (null si masqués & non clos) |
| POST | `/governance/polls/[{id}/open\|close/]` | *(bureau)* créer/ouvrir/clôturer |

**Workflow membre** : onglet Votes → liste · ouvre → détail (radio si single, checkbox si multi) · vote → POST `vote/ {option_ids}` (re-soumission remplace si `allow_change_vote`) · résultats → `results/` (gérer null) · polling 10 s tant qu'ouvert.

**Erreurs `vote/`** : 400 « pas ouvert » / « déjà voté » / « choix unique… » ; 403 pas membre. **Ne jamais** envoyer `voter` (dérivé serveur).

**Mobile** :
- Déjà : `polls()`, `getPoll()`, `votePoll()` ; onglet Votes (liste) — le tap ouvre une `Alert` placeholder.
- À faire : `PollDetailScreen` (options + bouton voter + barres résultats), `results()` dans governance.ts, polling 10 s.

---

## 4. Espace membre (perso)  🟡 (à compléter)
**Backend** : `core` (`User`, profil global) + `members` (`Membership`, `Role`/`MemberRole`, `MembershipFeePayment`, `Resignation`, `MembershipRequest`).

| Méthode | Route | Tenant ? | Usage |
|---|---|---|---|
| GET/PATCH | `/auth/me/` | non | profil global (nom, email, avatar, langue ; téléphone non modifiable) |
| GET | `/auth/associations/` | non | ses associations (switcher) |
| GET | `/members/memberships/` → filtrer `user_telephone` | oui | **sa fiche** (pas d'endpoint `/me/`) |
| GET | `/members/memberships/{id}/` | oui | détail (rôles/permissions, statut, member_number, signature) |
| POST | `/members/memberships/{id}/signature/` | oui | enregistrer signature `{signature:'data:image/png;base64,...'}` |
| GET | `/members/fees/by-membership/{id}/` | oui | ses frais d'adhésion (inscription + fond) |
| POST | `/members/resignations/` | oui | **démissionner** `{reason, effective_date?}` |
| GET | `/members/resignations/` | oui | suivi de ses démissions |
| POST | `/members/resignations/{id}/cancel/` | oui | annuler tant que `pending` |
| POST | `/members/membership-requests/` | oui | demander à adhérer (non-membre) |
| POST | `/auth/register-fcm-token/` | non | push device |

**Workflow membre** : login → `auth/me/` + `auth/associations/` · sa fiche → `memberships/` (filtrer téléphone) puis `memberships/{id}/` · frais → `fees/by-membership/{id}/` · édite profil/signature → PATCH `auth/me/` + POST `signature/` · démission → POST `resignations/` (suivi/annulation).

**Notes** :
- **Pas d'endpoint « mon membership »** → reproduire `useCurrentMembership` (lister + filtrer `user_telephone`).
- `TenantMiddleware` → 403 si `X-Tenant` d'une asso non rejointe. Sélectionner un slug valide d'abord.
- Rôle bureau/membre déduit de `membership.roles[].role.permissions` + `is_founder` (pas porté par `permission_classes`).

**Mobile** :
- Déjà : `membersApi.list()` (annuaire, séparé) ; `ProfileScreen.tsx`.
- À faire : hook `useCurrentMembership` ; écran fiche d'adhésion (statut, member_number, rôles, signature) ; section frais ; flux démission ; édition profil.

---

## Ordre de construction proposé
1. **Fil** (rapide : `unread_count` + `mark_read` + écran détail)
2. **Votes** (`PollDetailScreen` + `results()` + polling)
3. **Espace membre perso** (`useCurrentMembership` + fiche + frais + démission)
4. **Chat de groupe** (le plus lourd : API + types + 2 écrans + WS/typing/read + fallback)

## À confirmer avec le backend
- Durcir les permissions create/update/delete (governance, members) côté API.
- Bug `notify_all_members(audience=...)` : la diffusion push des annonces ne part probablement pas (TypeError avalé).
- Pagination/historique chat (>50 msg) ; endpoints mute/épingler/supprimer-message.
- Host de service du WebSocket chat pendant l'override Render du REST.
