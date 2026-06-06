# Handoff — Application mobile membre TontineX360

## Overview
Maquettes haute-fidélité de l'**app mobile membre** TontineX360 (parcours « mobile-first »).
Navigation par **tab bar à 5 onglets** : **Accueil · Tontines · Communauté · Finances · Profil**.
Objectif de ce handoff : **recréer ces écrans dans l'app Expo / React Native existante**
(`tontinex360_mobile`) puis **brancher chaque écran sur les routes API réelles**.

## About the design files
Les fichiers de `prototype/` sont des **références de design écrites en HTML/React (Babel
navigateur)** — ils montrent le rendu visuel et les interactions attendus. **Ce n'est pas du
code de production à copier tel quel.** La tâche est de **réimplémenter ces écrans dans
l'environnement cible** (Expo SDK + React Native + expo-router/React-Navigation, thème et
composants déjà présents dans `tontinex360_mobile/src`), pas d'embarquer le HTML.

Ouvrir `prototype/index.html` dans un navigateur pour voir le rendu interactif (cliquer la
tab bar pour naviguer).

## Fidelity
**Haute-fidélité (hifi).** Couleurs, typographie (Poppins), espacements, rayons et ombres
sont définitifs — voir `Design tokens`. Reproduire au pixel près en réutilisant le thème
(`src/theme/`) et les composants (`src/components/`) de l'app mobile.

---

## Environnement cible & conventions API

> Tout est déjà en place côté app — réutiliser, ne pas réinventer.

- **Client HTTP** : `src/lib/api/client.ts` (axios). Base URL via `src/config/env.ts`
  (`API_URL`, prod = `https://api.tontinex360.com/api`).
- **Auth** : header `Authorization: Bearer <access>` injecté automatiquement.
- **Multi-tenant** : header `X-Tenant: <association_slug>` injecté automatiquement
  (slug de l'association active). **Indispensable** sur toutes les routes métier.
- **401** : refresh auto via `POST /auth/token/refresh/ { refresh }` puis retry ; sinon
  déconnexion.
- **Pagination DRF** : réponses `{ count, next, previous, results }` → utiliser le helper
  `unwrap()` de `client.ts`.
- **Services existants** (parité avec le front web `tontinex_front/.../src/lib/api/`) :
  `auth, members, tontines, cycles, sessions, finance, wallets, pots, subscriptions,
  governance, invitations, notifications, proxies, events, sanctions, approvals,
  member-fees`. Côté mobile, `src/lib/api/` contient déjà `auth.ts`, `members.ts`,
  `client.ts` ; **porter les services manquants depuis le front web** (mêmes endpoints).
- **State / data fetching** : suivre le pattern existant (React Query côté web). Stores
  Zustand : `auth-store` (user, association active, membership courant), `notification-store`
  (compteur non-lu).
- **Devise** : montants en **XAF / FCFA**, format français séparateur d'espace
  (`125 000 FCFA`). Réutiliser un util `formatXAF`/`formatMoney`.

---

## Écrans & mapping des routes API

### 1. Accueil (`screen-home.jsx`)
**But** : vue d'ensemble personnelle du membre.
**Layout** : header (salutation + cloche notifications), bannière statut « à jour » (dégradé
lime→vert), 2 stat-tiles (tontine + tour), carte progression cotisations, CTA principal,
carte activité récente, bannière « aucun retard ».
**Données → routes :**
| Élément | Service / endpoint | Notes |
|---|---|---|
| Solde / tontine courante | `walletsApi.myWallet()` → `GET /wallets/me/` | montant + libellé tontine |
| Compteur notifications (badge cloche) | `notificationsApi.unreadCount()` → `GET /notifications/unread-count/` | |
| Progression cotisations (X/12) | `financeApi.contributions.list({ page_size })` → `GET /finance/contributions/` | filtrer `status='validated'` |
| « Votre tour » N°/total | `cyclesApi` / `potsApi` (ordre de passage du cycle actif) | confirmer le serializer |
| Activité récente | `notificationsApi.list({ page_size: 5 })` | |
| CTA « Cotiser maintenant » | navigation → onglet **Tontines** | (dépôt non-custodial : upload de preuve) |

### 2. Tontines (`screen-contribute.jsx`)
**But** : la tontine du membre + historique de cotisations.
**Layout** : hero (illustration tirelire) avec statut global + prochaine échéance, 3 mini-stats
(total cotisé / mois payés / mois en retard), CTA, liste historique des cotisations.
**Données → routes :**
| Élément | Service / endpoint | Notes |
|---|---|---|
| Mes souscriptions / tontines | `tontinesApi.subscriptions()` → `GET /tontines/subscriptions/` | filtrer par `membership` courant |
| Statut « À jour » + prochaine échéance | dérivé de `financeApi.contributions.list()` | date + montant dus |
| Total cotisé / mois payés / en retard | agrégation de `GET /finance/contributions/` | |
| Historique (lignes mensuelles) | `GET /finance/contributions/?ordering=-date` | `status`, `paid_at`, `amount` |
| CTA « Cotiser » | flux upload preuve → `POST /finance/contributions/` (+ pièce jointe) | validation par le trésorier |

### 3. Communauté (`screen-community.jsx`)
**But** : annonces, réunions/événements, votes, membres.
**Layout** : onglets segmentés (Fil / Réunions / Votes / Membres), hero annonce du bureau
(illustration calendrier) + CTA présence, sous-onglets (À venir / Passées / Calendrier),
liste d'événements avec bouton « Je participe ».
**Données → routes :**
| Élément | Service / endpoint | Notes |
|---|---|---|
| Annonce du bureau / fil | `announcementsApi` → `GET /announcements/` | |
| Réunions / événements | `eventsApi.list()` / `sessionsApi.list()` → `GET /events/` | À venir = filtre `status`/date |
| « Confirmer ma présence » / « Je participe » | `eventsApi.rsvp(id)` → `POST /events/{id}/attendance/` | confirmer la route |
| Votes / sondages | `governanceApi.polls()` → `GET /governance/polls/` | badge 🔒 si anonyme |
| Membres | `membersApi.list()` → `GET /members/` | |

### 4. Finances (`screen-finances.jsx`)
**But** : portefeuille (ledger), actions rapides, prochaine échéance, transactions.
**Layout** : hero solde disponible (illustration), sous-carte argent engagé / gains, grille
4 actions rapides (Retrait / Transférer / Demander / Relevé), carte prochaine échéance +
« Payer maintenant », liste dernières transactions.
**Données → routes :**
| Élément | Service / endpoint | Notes |
|---|---|---|
| Solde disponible | `walletsApi.myWallet()` → `GET /wallets/me/` | + conversion USD éventuelle |
| Argent engagé (prêt en cours) | `financeApi.loans.list({ status })` → `GET /finance/loans/` | |
| Gains totaux du cycle | `potsApi.payouts()` → `GET /pots/payouts/` | filtrer `membership` |
| Dernières transactions | `walletsApi.transactions()` → `GET /wallets/transactions/` | signe +/- selon type |
| Prochaine échéance / montant | `financeApi.contributions.list()` | |
| Actions (Retrait/Transfert) | `POST /wallets/withdraw/`, `POST /wallets/transfer/` | non-custodial : suivi + preuve |
| Relevé | `GET /wallets/statement/` (PDF) ou génération locale | |

### 5. Profil (`screen-profile.jsx`)
**But** : compte, préférences, association, support, déconnexion.
**Layout** : hero profil (avatar + badge photo, nom, téléphone, chip rôle, mini-stats),
sections de lignes (Compte / Préférences / Mon association / Support), bouton déconnexion.
**Données → routes :**
| Élément | Service / endpoint | Notes |
|---|---|---|
| Infos profil (nom, téléphone, avatar) | `authApi.me()` → `GET /auth/me/` | |
| Modifier mon profil | `authApi.updateMe(data)` → `PATCH /auth/me/` | |
| Photo de profil | `PATCH /auth/me/` (multipart) + `expo-image-picker` | recadrage 1:1 |
| Changer le mot de passe | `authApi.changePassword()` → `POST /auth/change-password/` | |
| Notifications (toggle) | préférence → `POST /auth/register-fcm-token/` + prefs serveur | + `expo-notifications` |
| Langue · Language | préférence locale (FR/EN) + persistance | i18n existant |
| Mon adhésion / association | `authApi.myAssociations()` → `GET /associations/associations/` | rôle, N° membre |
| Mes procurations | `proxiesApi.list()` → `GET /proxies/` | |
| N° membre / membre depuis | `membersApi` (membership courant) | |
| Se déconnecter | `logout()` (`src/lib/auth/session.ts`) | purge tokens + reset nav |

---

## Interactions & comportements
- **Press states** : `opacity: 0.85` + `scale(0.99)` ; disabled `opacity: 0.5`.
- **Tab bar** : 5 onglets, actif = vert primary `#43793F`, inactif = `#A0A0A0`.
- **Pull-to-refresh** sur les listes (tint vert).
- **Toggle notifications** : composant Switch (off `#EBEBEB` → on lime `#87C241`).
- **Onglets segmentés** (Communauté) : pilule active dégradé lime→vert, texte blanc.
- **Toast** global pour feedback d'action (déjà câblé dans le prototype).
- Pas d'animations décoratives en boucle ; transitions courtes/fades.

## State management
- `auth-store` (Zustand) : `user`, `activeAssociation`, `currentMembership`.
- `notification-store` : `unreadCount` (auto-refresh).
- Préférences locales (langue, notifications) : `expo-secure-store`.
- Data fetching : un hook/quéry par écran (cf. tableaux ci-dessus), états loading
  (skeletons) et empty/error gérés.

## Design tokens
**Couleurs** — primary `#43793F`, primaryDark `#3D6A2A`, lime `#87C241`, limeSoft `#A8D26A`,
greenBg `#F1F8E8`, greenBgDeep `#E0F0CC`, accent (gold) `#E5BC2C`, accentSoft `#FBF6CF`,
danger `#9A5356`, dangerSoft `#FCE7E7`, ok `#34C759`, info `#007AFF`. Neutres : background
`#FAFAFA`, surface `#F4F4F5`, surfaceMuted `#EBEBEB`, border `#DFDEDE`, textMuted `#707070`,
textLight `#A0A0A0`, text `#1E3233`. (Détail complet : `colors_and_type.css`.)
**Typo** — Poppins 400/500/600/700. H1 29/700/-0.5, H2 25/700, H3 21/700, H4 17/600,
body 14/400, label 13/500, small 12/400, caption 10/400, bouton 16/600/+0.2.
**Espacements** — 4 / 8 / 16 / 24 / 32 / 48 / 64. **Rayons** — 8 / 16 (carte) / 24 (hero) /
32 / 999 (pill). **Ombres** (teintées vert) — card `0 2px 8px rgba(67,121,63,.08)`,
lifted `0 8px 24px rgba(67,121,63,.12)`. **Dégradés** — lime→primary 135°.

## Assets
- `assets/logo/` : `logo-full.png`, `logo-full-dark.png`, `logo-icon.png`.
- `assets/illustrations/` : `piggy-bank`, `farmer-wallet`, `calendar-meeting`, `ballot-box`,
  `documents`, `onboarding-1…4` (vecteurs plats verts — déjà dans
  `tontinex360_mobile/src/assets/illustrations/`).
- **Icônes** : **Ionicons** via `@expo/vector-icons` dans l'app (`home`, `wallet`, `people`,
  `person`, `trophy`, `checkmark-circle`, `notifications-outline`, `calendar`, `time`,
  `location`, `chevron-forward`, `create`, `lock-closed`, `shield-checkmark`, `globe`,
  `business`, `log-out`…). ⚠️ Le prototype HTML utilise des SVG inline équivalents
  (le composant `<ion-icon>` ne fonctionne pas en iframe) — **dans l'app, utiliser les vrais
  Ionicons.** L'onglet Tontines utilise une icône « stack/layers » (≈ `albums`/`layers`).

## Files
```
prototype/
  index.html              # point d'entrée — charge React + Babel + les écrans
  icons.jsx               # set d'icônes SVG inline (→ remplacer par Ionicons dans l'app)
  primitives.jsx          # tokens TX + Card/Button/Chip/IconBubble/StatTile/Avatar/…
  ios-frame.jsx           # bezel iPhone (prototype only — non requis dans l'app)
  app.jsx                 # TabBar 5 onglets + routage + toast
  screen-home.jsx         # Accueil
  screen-contribute.jsx   # Tontines
  screen-community.jsx    # Communauté
  screen-finances.jsx     # Finances
  screen-profile.jsx      # Profil
colors_and_type.css       # tokens couleur + typo (référence)
assets/                   # logos + illustrations
```

> ⚠️ Plusieurs valeurs (« Votre tour », N° membre, libellés de routes annotés « confirmer »)
> sont des **données fictives / hypothèses** — vérifier les noms de champs exacts contre les
> serializers DRF du backend (`tontine_project`).
