# Plan d'implémentation — Espace Bureau (TontineX360 Mobile)

> Statut : **MVP (Phases 0 → 4) IMPLÉMENTÉ** ✅ — typecheck `tsc --noEmit` OK. Phases 5 → 8 à venir.
> Périmètre 1ʳᵉ livraison : **MVP = Phases 0 → 4** (fondations, dashboard, membres, approbations, finance).
> Navigation : **BureauStack séparé** poussé depuis l'espace membre (Profil + Accueil), gated sur `isBureau`.
> Phases 5 → 8 : roadmap décrite en fin de document, hors MVP.

---

## 0. Principes & références

### 0.1 Sources de vérité
| Rôle | Projet | Usage |
|---|---|---|
| Backend (fait foi) | `tontine_project` (Django) | endpoints, payloads, permissions, moteur d'approbations |
| Vérité terrain d'intégration | `tontinex360-web` (Next.js) | quel endpoint chaque fonctionnalité appelle réellement |
| Référence visuelle / UX | `tontinex360-mobile` (démo, Expo Router) | disposition des écrans bureau (`app/admin/*`) |
| **Cible (où on code)** | `tontinex360_mobile` (Expo + @react-navigation) | l'app à étendre |

### 0.2 Deux écarts structurels à respecter
- La démo utilise **Expo Router** (`app/admin/*`) + un **SDK vendorisé** (`tx().x.list()`).
- La cible utilise **@react-navigation** (stacks/tabs en composants) + des **services Axios** (`src/lib/api/*`).
- ➡️ **On ne copie pas les écrans.** On reprend la *disposition* de la démo, reconstruite avec le design system cible (`src/components/ui`) et les services `lib/api`.

### 0.3 Acquis déjà en place (à NE PAS recréer)
- Client Axios complet : `src/lib/api/client.ts` (Bearer, header `X-Tenant`, refresh 401, `unwrap()` pagination DRF).
- Permissions : `src/lib/permissions.ts` (`hasPermission`, `isBureau`, `isPresident`, `getLandingRoute`) + hook `src/lib/hooks/use-permissions.ts` (`can`, `canAny`, `canAll`, `isBureau`, `isPresident`).
- Types membres/rôles : `src/lib/types/member.ts` (`Membership`, `Role`, `MemberRole`, `MembershipListItem`).
- `getLandingRoute()` renvoie déjà `'Dashboard'` pour le bureau → **point de branchement existant**.
- Design system : `src/components/ui/*` (Card, Buttons, TextField, PhoneField, IconBubble, SectionHeader, StatTile, Chip, ProgressBar, GradientBackground…).

### 0.4 Conventions de code à suivre (déjà en vigueur)
- Un service par domaine : `export const xxxApi = { method: (params) => api.get/post(...).then(r => unwrap(r.data) | r.data) }`.
- Listes : tolérer tableau brut **ou** enveloppe DRF via `unwrap()`.
- Écrans : `SafeAreaView` + `ScrollView` + `RefreshControl`, données via `useQuery`, actions via `useMutation` + `queryClient.invalidateQueries`.
- Gating : masquer écrans/boutons via `usePermissions()` ; le backend reste l'autorité finale (gérer les 403).

---

## 1. MVP — vue d'ensemble des phases

| Phase | Contenu | Dépend de |
|---|---|---|
| **0** | Socle : navigation BureauStack, services API bureau, types, gating, point d'entrée | — |
| **1** | Dashboard bureau (grille de modules) | 0 |
| **2** | Gestion des membres (membres / demandes / démissions / bureau / invitations) | 0, 1 |
| **3** | Moteur d'approbations (liste, détail, approuver/rejeter) — **transversal** | 0, 1 |
| **4** | Finance (cotisations / prêts / remboursements / transactions) | 0, 1, 3 |

> Note transversale : Phase 3 (Approvals) précède la partie « actions sensibles » de la Phase 4 (ex. `loan.approve`, corrections) et de la Phase 2 (suspension/expulsion). On construit donc le moteur tôt, puis on y branche les actions.

---

## PHASE 0 — Fondations

### 0.A Navigation (BureauStack séparé)
**Fichiers à créer / modifier :**

- `src/navigation/types.ts` *(modifier)* — ajouter le param-list bureau et le brancher dans `AppStackParamList` :
  ```ts
  export type BureauStackParamList = {
    BureauDashboard: undefined;
    // Phase 2
    BureauMembers: undefined;
    BureauMemberDetail: { id: string };
    BureauInvitations: undefined;
    // Phase 3
    BureauApprovals: undefined;
    BureauApprovalDetail: { id: string };
    // Phase 4
    BureauFinance: undefined;
    BureauContributionDetail: { id: string };
    BureauLoanDetail: { id: string };
  };
  // Dans AppStackParamList, ajouter :
  //   Bureau: NavigatorScreenParams<BureauStackParamList>;
  ```
- `src/navigation/BureauStack.tsx` *(créer)* — `createNativeStackNavigator<BureauStackParamList>()`, réutiliser le `detailHeader` de `AppStack.tsx`. En MVP, déclarer toutes les routes ci-dessus (placeholders pour celles pas encore faites).
- `src/navigation/AppStack.tsx` *(modifier)* — ajouter `<Stack.Screen name="Bureau" component={BureauStack} options={{ headerShown: false }} />`.

### 0.B Point d'entrée (gated `isBureau`)
- `src/screens/app/ProfileScreen.tsx` *(modifier)* — carte "Espace Bureau" (LinearGradient + badge BUREAU) visible si `usePermissions().isBureau`, `onPress = navigation.navigate('Bureau', { screen: 'BureauDashboard' })`. (Équivalent du `profile.tsx` de la démo.)
- `src/screens/app/HomeScreen.tsx` *(modifier, optionnel)* — raccourci "Espace Bureau" dans les quick actions si `isBureau`.

### 0.C Composant de gating réutilisable
- `src/components/bureau/RequirePermission.tsx` *(créer)* — wrapper : `({ anyOf?, allOf?, president?, fallback?, children })` s'appuyant sur `usePermissions()`. Sert à masquer boutons/sections (pas de sécurité réelle — le backend tranche).

### 0.D Couche API bureau (services)
Étendre les services existants et en créer de nouveaux. **MVP = ce qui sert aux phases 1–4.**

**Créer :**
- `src/lib/api/approvals.ts` — voir Phase 3.
- `src/lib/api/invitations.ts` — voir Phase 2.

**Étendre :**
- `src/lib/api/members.ts` *(modifier)* — actuellement seulement `list`/`get`. Ajouter :
  ```
  create, update(id), remove(id), signature(id)
  roles.list/create/update/remove
  bureauPositions.list/create/update/remove
  bureauMembers.list({cycle,is_active})/create/update/remove
  requests.list/approve(id)/reject(id)
  resignations.list/approve(id)/reject(id)
  imports.preview/create
  fees.list/create/config(get,patch)
  ```
- `src/lib/api/finance.ts` *(modifier)* — voir Phase 4 (validate/reject contributions, loans lifecycle, correction-requests, treasury, loan-settings, tontine-balances, loan-repayments).

**Plus tard (hors MVP) :** `src/lib/api/sanctions.ts`, extensions `cycles.ts`, `wallets.ts`, `governance.ts`, `proxies.ts`.

### 0.E Types
- `src/lib/types/member.ts` *(modifier)* — ajouter `BureauPosition`, `BureauMember`, `MembershipRequest`, `Resignation`.
- `src/lib/types/approval.ts` *(créer)* — `BureauApprovalRequest`, statuts, `ApprovalPolicy`, `action_type`.
- `src/lib/types/finance.ts` *(modifier)* — compléter `Loan` (lifecycle/garants), `LoanRepayment`, `TreasuryAccount`, `CorrectionRequest`, `TontineBalance`, `LoanSettings`.
- `src/lib/types/invitation.ts` *(créer)*.

### 0.F Livrable Phase 0
App qui compile, carte "Espace Bureau" visible pour un membre du bureau, ouvrant un `BureauStack` avec un dashboard placeholder. Aucune régression sur l'espace membre.

---

## PHASE 1 — Dashboard Bureau

**Référence visuelle :** `app/admin/index.tsx` (démo) — hero dégradé + badge "BUREAU", grille de tuiles (≈3 colonnes), note d'info en bas.

- `src/screens/bureau/BureauDashboardScreen.tsx` *(créer)* :
  - Hero `GradientBackground` + greeting + badge.
  - Grille de tuiles (icône `IconBubble` + libellé + description) ; chaque tuile `navigation.navigate(...)`.
  - **MVP : 3 tuiles actives** → Membres (Phase 2), Approbations (Phase 3), Finance (Phase 4). Les autres tuiles (Cycles, Gouvernance, Sanctions, Trésorerie, Paramètres…) présentes mais désactivées / "Bientôt".
  - Badges compteurs optionnels : demandes d'adhésion en attente, approbations en attente.
- `src/components/bureau/ModuleTile.tsx` *(créer)* — tuile réutilisable (press scale 0.97).

**Livrable :** dashboard fidèle à la démo, navigation vers les 3 modules MVP.

---

## PHASE 2 — Gestion des membres

**Référence visuelle :** `app/admin/members.tsx` (4 onglets horizontaux) + `app/admin/invitations.tsx`.

### Écrans
- `src/screens/bureau/BureauMembersScreen.tsx` *(créer)* — onglets horizontaux **Membres / Demandes / Démissions / Bureau**.
- `src/screens/bureau/BureauMemberDetailScreen.tsx` *(créer)* — fiche membre + actions (suspendre/expulser → via Approvals Phase 3).
- `src/screens/bureau/BureauInvitationsScreen.tsx` *(créer)* — formulaire (nom, `PhoneField`, email, canal WhatsApp/SMS/Email/Lien) + liste des invitations.
- `src/components/bureau/TabsRow.tsx` *(créer)* — barre d'onglets horizontaux + badges compteurs (réutilisée en Phases 4+).
- `src/components/bureau/StatusChip.tsx` + `ActionBtn.tsx` *(créer)* — pastilles de statut + petits boutons ✓/✗.

### Endpoints (mapping fonctionnalité → API)
| Action | Méthode + URL | Permission |
|---|---|---|
| Lister membres | `GET /members/memberships/?search=&status=` | IsMember |
| Détail membre | `GET /members/memberships/{id}/` | IsMember |
| Modifier membre | `PATCH /members/memberships/{id}/` | Bureau |
| Demandes d'adhésion | `GET /members/membership-requests/` | Bureau |
| Approuver / rejeter adhésion | `POST .../{id}/approve/` · `POST .../{id}/reject/` | Bureau |
| Démissions | `GET /members/resignations/` | Bureau |
| Approuver / rejeter démission | `POST .../{id}/approve/` · `POST .../{id}/reject/` | Bureau |
| Postes bureau | `GET /members/bureau-positions/` | IsMember |
| Membres du bureau (cycle) | `GET /members/bureau-members/?is_active=true` | IsMember |
| Désigner au bureau | `POST /members/bureau-members/` *(→ Approval `member.designate_bureau`)* | Bureau |
| Inviter | `POST /invitations/send/` | `members.invite` |
| Lister / relancer / annuler invitation | `GET /invitations/list/` · `POST /invitations/{id}/resend/` · `/cancel/` | `members.invite` |
| Suspendre / Expulser | *via Approvals* `member.suspend` / `member.expel` | Bureau (double) |

**Livrable :** consultation + actions directes (adhésions, démissions, invitations) ; actions sensibles déléguées à la Phase 3.

---

## PHASE 3 — Moteur d'approbations (transversal)

**Référence visuelle :** `approvals/page.tsx` (web). Pas d'écran dédié dans la démo → s'inspirer du web.

### Concepts backend (rappel)
- Modèle `BureauApprovalRequest` : `action_type`, `target_model/target_id`, `payload`, `reason`, jusqu'à 3 slots (`president_approval`, `bureau_approval`, `bureau_approval_2`), `requires_triple`, `status`, `expires_at` (24h), `votes[]`, `policy_snapshot`.
- Statuts : `pending → pres_approved / bureau_approved → approved` | `rejected` | `cancelled` | `expired` | `failed`.
- Règles de décision (policies) : `unanimous` (défaut) / `majority` / `president_overrides`.
- Triple validation : `cycle.close`, `session.cancel`, `election.validate_results`. Double : le reste (`loan.approve`, `member.expel/suspend`, corrections, `wallet.manual_adjustment`…).

### Fichiers
- `src/lib/api/approvals.ts` *(créer)* :
  ```
  list({status,action_type}), get(id),
  request({action_type,target_id,payload,reason}),
  approve(id), reject(id,{rejection_reason}), cancel(id),
  handlers(), policies.list(), policies.update(actionType), policies.reset(actionType)
  ```
- `src/lib/types/approval.ts` *(créé en Phase 0)*.
- `src/screens/bureau/BureauApprovalsScreen.tsx` *(créer)* — liste filtrable (status / action_type), badges, compte à rebours d'expiration.
- `src/screens/bureau/BureauApprovalDetailScreen.tsx` *(créer)* — diff proposé (`payload` vs `original_snapshot`), 3 slots de validation, boutons Approuver/Rejeter (gated), annulation si demandeur.
- `src/lib/hooks/use-approval-action.ts` *(créer)* — helper pour déclencher une demande d'approbation depuis n'importe quel écran (`request(action_type, target_id, payload, reason)`), puis rediriger vers le détail.

### Endpoints
| Action | Méthode + URL |
|---|---|
| Lister | `GET /approvals/?status=&action_type=` |
| Détail | `GET /approvals/{id}/` |
| Créer demande | `POST /approvals/request/` |
| Approuver | `POST /approvals/{id}/approve/` |
| Rejeter | `POST /approvals/{id}/reject/` (`{rejection_reason}`) |
| Annuler | `POST /approvals/{id}/cancel/` |
| Handlers dispo | `GET /approvals/handlers/` |
| Policies (Président) | `GET /approvals/policies/` · `PATCH /approvals/policies/{action_type}/` · `DELETE /approvals/policies/{action_type}/reset/` |

**Livrable :** centre d'approbations fonctionnel + hook réutilisable. Les Phases 2 et 4 branchent leurs actions sensibles dessus.

---

## PHASE 4 — Finance

**Référence visuelle :** `app/admin/finance.tsx` (4 onglets) + détails.

### Écrans
- `src/screens/bureau/BureauFinanceScreen.tsx` *(créer)* — onglets **Cotisations / Prêts / Remboursements / Transactions** (réutilise `TabsRow`).
- `src/screens/bureau/BureauContributionDetailScreen.tsx` *(créer)* — valider / rejeter / signer reçu ; demander correction (→ Approvals).
- `src/screens/bureau/BureauLoanDetailScreen.tsx` *(créer)* — cycle de vie du prêt (offre, contre-offre, allocation, garants) ; approbation (→ Approvals `loan.approve`).

### Extensions API (`src/lib/api/finance.ts`)
Ajouter aux méthodes existantes :
```
validateContribution(id), rejectContribution(id), requestContributionCorrection(id, payload)
correctionRequests.list / approve(id) / reject(id)
loans.update(id), counterOffer(id), acceptOffer(id), declineOffer(id),
  attachGuarantors(id), allocateSession(payload), capacity(params), coverage(params), myGuarantees()
loanRepayments.list / signReceipt(id)
treasury.list / create / update(id)
tontineBalances.list / get(tontineTypeId)
loanSettings.get / update   (Président)
```

### Endpoints
| Action | Méthode + URL | Permission |
|---|---|---|
| Cotisations | `GET /finance/contributions/?session=&status=` | IsMember |
| Valider / rejeter cotisation | `POST .../{id}/validate/` · `/reject/` | `finance.collect` |
| Signer reçu | `POST /finance/contributions/{id}/sign_receipt/` | Bureau |
| Demander correction | `POST /finance/contributions/{id}/request-correction/` | IsMember |
| Corrections | `GET /finance/correction-requests/` · `POST .../{id}/approve|reject/` | Bureau (double) |
| Prêts | `GET /finance/loans/?status=` | IsMember |
| Approuver prêt | *via Approvals* `loan.approve` | Bureau (double) |
| Contre-offre / accepter / refuser | `POST /finance/loans/{id}/counter-offer|accept-offer|decline-offer/` | mixte |
| Allouer prêts séance | `POST /finance/loans/allocate-session/` | `finance.loans` |
| Garants | `POST /finance/loans/{id}/attach-guarantors/` · `/guarantor-accept|decline/` · `GET /finance/loans/my-guarantees/` | mixte |
| Remboursements | `GET /finance/loan-repayments/` · `POST .../{id}/sign_receipt/` | Bureau |
| Trésorerie | `GET/POST/PATCH /finance/treasury/` | Bureau |
| Transactions (audit) | `GET /finance/transactions/` | `finance.audit` |
| Soldes par tontine | `GET /finance/tontine-balances/` · `/{id}/` | Bureau |
| Paramètres prêts | `GET/PATCH /finance/loan-settings/` | Président |

**Livrable :** gestion financière bureau complète, corrections et approbation de prêts passant par le moteur d'approbations.

---

## 2. Roadmap post-MVP (Phases 5 → 8, hors 1ʳᵉ livraison)

| Phase | Contenu | Endpoints principaux |
|---|---|---|
| **5 — Cycles & séances** | cycles (création, `generate-sessions`), séances (présences, clôture, rapport), cagnottes (open/distribute/auction/close), distributions + signature. Clôture cycle / annulation séance → **triple approval**. | `/cycles/*`, `/cycles/pots/*`, `/cycles/payouts/*`, `/cycles/attendances/` |
| **6 — Gouvernance** | élections + candidats + résultats (→ approval), documents, sondages (open/close/results), annonces. | `/governance/*` |
| **7 — Sanctions · Wallets admin · Proxies** | types & application de sanctions ; wallets admin + ajustement manuel (→ approval) + settlement ; procurations (approuver/rejeter/active). | `/sanctions/*`, `/wallets/*`, `/proxies/*` |
| **8 — Paramètres & temps réel** | rôles & permissions, policies d'approbation, paramètres association ; canal chat « Bureau » (réutiliser `use-chat-socket`), notifications bureau, rapports de session/pièces jointes. | `/members/roles/`, `/approvals/policies/`, `/chat/*`, `/notifications/*` |

---

## 3. Récap des fichiers (MVP)

**Créés**
```
src/navigation/BureauStack.tsx
src/components/bureau/RequirePermission.tsx
src/components/bureau/ModuleTile.tsx
src/components/bureau/TabsRow.tsx
src/components/bureau/StatusChip.tsx
src/components/bureau/ActionBtn.tsx
src/screens/bureau/BureauDashboardScreen.tsx
src/screens/bureau/BureauMembersScreen.tsx
src/screens/bureau/BureauMemberDetailScreen.tsx
src/screens/bureau/BureauInvitationsScreen.tsx
src/screens/bureau/BureauApprovalsScreen.tsx
src/screens/bureau/BureauApprovalDetailScreen.tsx
src/screens/bureau/BureauFinanceScreen.tsx
src/screens/bureau/BureauContributionDetailScreen.tsx
src/screens/bureau/BureauLoanDetailScreen.tsx
src/lib/api/approvals.ts
src/lib/api/invitations.ts
src/lib/types/approval.ts
src/lib/types/invitation.ts
src/lib/hooks/use-approval-action.ts
```

**Modifiés**
```
src/navigation/types.ts          (+ BureauStackParamList, + Bureau dans AppStackParamList)
src/navigation/AppStack.tsx      (+ écran Bureau)
src/screens/app/ProfileScreen.tsx(+ carte Espace Bureau gated)
src/screens/app/HomeScreen.tsx   (+ raccourci, optionnel)
src/lib/api/members.ts           (+ roles, bureau, requests, resignations, imports, fees)
src/lib/api/finance.ts           (+ validate/reject, loans lifecycle, treasury, corrections, settings)
src/lib/types/member.ts          (+ BureauPosition, BureauMember, MembershipRequest, Resignation)
src/lib/types/finance.ts         (+ LoanRepayment, TreasuryAccount, CorrectionRequest, TontineBalance, LoanSettings)
```

---

## 4. Risques & points d'attention
- **Permissions backend laxistes** par endroits (governance/members parfois seulement `IsMember`) : le gating mobile est cosmétique, toujours gérer les 403 proprement.
- **Multi-tenant** : toute requête bureau dépend du `X-Tenant` actif (déjà géré par le client) ; vérifier le bon `currentMembership` après switch d'association.
- **Cycle courant** : plusieurs endpoints bureau (bureau-members, pots) sont scopés au cycle actif → prévoir la résolution du cycle courant.
- **Approbations expirables (24h)** : afficher l'expiration et rafraîchir les listes.
- **Ne pas réimplémenter** ce qui existe (client, permissions, design system).
