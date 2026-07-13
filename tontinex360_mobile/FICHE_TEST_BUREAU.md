# Fiche de test — Espace Bureau (MVP, Phases 0 → 4)

> Objectif : valider manuellement tout ce qui a été ajouté pour l'espace bureau.
> Plateforme : app mobile `tontinex360_mobile` (Expo). Backend de référence : `tontine_project`.

---

## 1. Prérequis avant de tester

| # | Condition | Comment l'obtenir |
|---|---|---|
| 1 | Application qui démarre | `npm start` (puis `a`/`i`) ou `npm run android` / `npm run ios` |
| 2 | Un compte **membre du bureau** | L'utilisateur connecté doit être `is_founder = true` **OU** avoir un rôle actif avec `is_bureau_role = true` (Président, Trésorier, Secrétaire…). Sinon l'entrée bureau n'apparaît pas. |
| 3 | Une **association active** sélectionnée | Après login, être dans l'espace App (5 onglets visibles). Le header `X-Tenant` est posé automatiquement. |
| 4 | (Idéal) un compte **Président** et un compte **membre simple** | Pour tester le gating (le membre simple ne doit PAS voir l'espace bureau) et le flux d'approbation à 2 validateurs. |

--> President : 677889913 
--> Membres : 677889914

--> steve : 655362943

> ⚠️ Le gating dans l'app est **cosmétique** : si un endpoint renvoie 403, l'action est bloquée côté serveur et une alerte « Erreur » s'affiche. C'est un comportement **attendu**, pas un bug.

---

## 2. Point d'entrée de l'espace bureau

1. Aller sur l'onglet **Profil** (5ᵉ onglet).
2. Sous le bloc d'identité (hero), une carte verte **« Espace Bureau »** doit apparaître (uniquement si le compte est bureau).
3. Taper dessus → ouverture du **Dashboard bureau**.

**À vérifier :**
- [ ] Avec un compte **bureau** : la carte « Espace Bureau » est visible.
- [ ] Avec un compte **membre simple** : la carte n'apparaît **pas**.
- [ ] Le sous-titre de la carte affiche le rôle (« Président » / « Bureau »).

---

## 3. Récapitulatif des ajouts (fichiers)

| Domaine | Fichiers créés / modifiés |
|---|---|
| Navigation | `src/navigation/BureauStack.tsx` (créé), `src/navigation/types.ts` (modifié), `src/navigation/AppStack.tsx` (modifié) |
| Entrée | `src/screens/app/ProfileScreen.tsx` (carte bureau) |
| Écrans bureau | `src/screens/bureau/` → `BureauDashboardScreen`, `BureauMembersScreen`, `BureauMemberDetailScreen`, `BureauInvitationsScreen`, `BureauApprovalsScreen`, `BureauApprovalDetailScreen`, `BureauFinanceScreen`, `BureauContributionDetailScreen`, `BureauLoanDetailScreen`, `BureauPlaceholderScreen` |
| Composants | `src/components/bureau/` → `ModuleTile`, `TabsRow`, `StatusChip`, `ActionBtn`, `RequirePermission` |
| Services API | `src/lib/api/approvals.ts`, `invitations.ts` (créés) ; `members.ts`, `finance.ts` (étendus) |
| Types | `src/lib/types/approval.ts`, `invitation.ts` (créés) ; `member.ts`, `finance.ts` (étendus) |
| Helpers | `src/lib/hooks/use-approval-action.ts`, `src/lib/bureau/approval-labels.ts`, `src/lib/bureau/finance-labels.ts` |

---

## 4. Scénarios de test détaillés

### 4.1 Dashboard bureau
**Accès :** Profil → Espace Bureau

| À tester | Résultat attendu |
|---|---|
| Affichage du hero | Dégradé vert + badge « BUREAU » + « Bonjour {prénom} » + nom de l'association |
| Grille de modules | 9 tuiles. **Actives** : Membres, Approbations, Finance, Invitations. **Désactivées** (grisées, libellé « Bientôt ») : Cycles, Gouvernance, Sanctions, Trésorerie, Paramètres |
| Badge sur « Membres » | Pastille rouge = nombre de demandes d'adhésion en attente (si > 0) |
| Badge sur « Approbations » | Pastille rouge = nombre d'approbations en attente (si > 0) |
| Tap sur une tuile active | Ouvre l'écran correspondant |
| Tap sur une tuile « Bientôt » | Ne fait rien |
| Note du bas | Texte différent si Président vs autre membre du bureau |

- [ ] Dashboard OK

---

### 4.2 Module **Membres** (4 onglets)
**Accès :** Dashboard → Membres

**Onglet Membres**
- [ ] Liste des membres (nom, poste/« Membre », n° d'adhésion, statut coloré)
- [ ] Tap sur une ligne → ouvre la **fiche membre**

**Onglet Demandes** (badge = nombre en attente)
- [ ] Liste des demandes d'adhésion en attente
- [ ] Bouton **✓ vert** → approuve (la demande disparaît, un membre est créé) — `POST /members/membership-requests/{id}/approve/`
- [ ] Bouton **✗ rouge** → rejette — `POST .../reject/`

**Onglet Démissions**
- [ ] Liste des démissions ; les **pending** ont les boutons ✓/✗, les autres affichent un statut
- [ ] Approuver / rejeter fonctionne — `POST /members/resignations/{id}/approve|reject/`

**Onglet Bureau**
- [ ] Liste des postes attribués (poste + titulaire + ancienneté) — `GET /members/bureau-members/?is_active=true`

**Bouton en haut à droite (icône ajout)**
- [ ] Ouvre l'écran **Invitations**

**Pull-to-refresh**
- [ ] Tirer vers le bas recharge les listes

- [ ] Module Membres OK

---

### 4.3 Fiche **Membre** (détail)
**Accès :** Membres → onglet Membres → taper un membre

| À tester | Résultat attendu |
|---|---|
| Identité | Avatar initiales, nom, téléphone, statut |
| Infos | N° de membre, date d'adhésion, fondateur (oui/non), email |
| Rôles | Liste des rôles actifs (badge « Bureau » sur les rôles bureau) ; « membre lambda » si aucun |
| Bloc Actions | Visible seulement si Président **ou** permission `members.*` |
| Bouton **Suspendre** | Confirmation → crée une demande d'approbation `member.suspend` → alerte « Demande envoyée » + bouton « Voir » |
| Bouton **Exclure** | Idem avec `member.expel` |

> Note : suspendre/exclure ne s'appliquent **pas** immédiatement — ils passent par le moteur d'approbations (voir 4.5).

- [ ] Fiche membre OK

---

### 4.4 Module **Invitations**
**Accès :** Dashboard → Invitations (ou bouton + dans Membres)

| À tester | Résultat attendu |
|---|---|
| Formulaire | Champs Nom, Téléphone, Email + sélecteur de canal (WhatsApp / SMS / Email / Lien) |
| Bouton actif/inactif | « Envoyer » désactivé tant que Nom vide ; selon canal : Email exige l'email, SMS/WhatsApp exigent le téléphone, Lien n'exige rien d'autre |
| Envoi | `POST /invitations/send/` → alerte succès, champs vidés, l'invitation apparaît dans la liste |
| Liste | Invitations envoyées avec icône du canal + statut (En attente/Acceptée/…) + ancienneté |

- [ ] Module Invitations OK

---

### 4.5 Module **Approbations** ⭐ (cœur du système)
**Accès :** Dashboard → Approbations

**Liste**
- [ ] Onglets : En attente (badge) / Approuvées / Rejetées / Toutes
- [ ] Chaque ligne : libellé de l'action (FR), résumé, **« Expire dans … »** pour les pending, icône bouclier si triple validation
- [ ] Tap → ouvre le détail

**Détail** (`GET /approvals/{id}/`)
- [ ] En-tête : action + demandeur + statut ; mention « Triple validation requise » si applicable
- [ ] Motif / résumé / date de création / expiration
- [ ] **Changement proposé** : tableau ancienne valeur → nouvelle valeur
- [ ] **Validations** : slots Président / Bureau (+ Bureau 2 si triple) avec nom + date ou « En attente »
- [ ] Bouton **Approuver** → `POST .../approve/` ; le statut progresse (ex. pending → pres_approved)
- [ ] Bouton **Rejeter** → ouvre un champ motif (≥ 3 caractères) → `POST .../reject/`
- [ ] Bouton **Annuler ma demande** visible **uniquement** si je suis le demandeur → `POST .../cancel/`

**Flux complet recommandé (2 comptes) :**
1. Compte A (bureau) : depuis une fiche membre, lancer **Suspendre** → une approbation `member.suspend` est créée (statut *pending*).
2. Compte Président : ouvrir l'approbation → **Approuver**.
3. Compte A (ou un 2ᵉ membre du bureau) : **Approuver** à son tour.
4. Vérifier le passage en **Approuvé** et l'application de l'effet (le membre passe « Suspendu »).

- [ ] Module Approbations OK

---

### 4.6 Module **Finance** (4 onglets)
**Accès :** Dashboard → Finance

**Onglet Cotisations**
- [ ] Liste (montant, membre). Les cotisations en attente/à valider/partielles ont les boutons **✓/✗** ; les autres affichent un statut
- [ ] **✓** valide → `POST /finance/contributions/{id}/validate/`
- [ ] **✗** rejette → `POST .../reject/`
- [ ] Tap sur une ligne → **détail cotisation**

**Onglet Prêts**
- [ ] Liste (montant, membre, statut) ; tap → **détail prêt**

**Onglet Remboursements**
- [ ] Liste en lecture (montant, date, badge « Signé » si reçu)

**Onglet Transactions**
- [ ] Liste en lecture (montant signé +/-, libellé, date) — `GET /finance/transactions/`

- [ ] Module Finance OK

---

### 4.7 Détail **Cotisation**
**Accès :** Finance → Cotisations → taper une ligne

| À tester | Résultat attendu |
|---|---|
| Infos | Montant attendu / payé, tontine, méthode, date, correction en attente |
| Si en attente | Boutons **Valider** + **Rejeter** (avec champ motif) |
| Si déjà validée | Bouton **Demander une correction** : champs montant + motif → `POST .../request-correction/` (double validation) |
| Gating | Bloc actions visible si permission `finance.collect`/`finance.*` ou Président |

- [ ] Détail cotisation OK

---

### 4.8 Détail **Prêt**
**Accès :** Finance → Prêts → taper une ligne

| À tester | Résultat attendu |
|---|---|
| Infos | Montant, montant approuvé, intérêt, total dû, remboursé, restant, échéance, motif |
| Si prêt **en attente** | Bouton **Approuver le prêt** → crée une approbation `loan.approve` (→ alerte + « Voir ») |
| | Bouton **Faire une contre-offre** → champ montant → `POST /finance/loans/{id}/counter-offer/` |
| Gating | Bloc actions visible si `finance.loans`/`finance.*` ou Président |

- [ ] Détail prêt OK

---

## 5. Tests transverses

| À tester | Résultat attendu |
|---|---|
| Retour navigation | La flèche retour ramène à l'écran précédent ; depuis le Dashboard, retour → Profil |
| Refus serveur (403) | Sur un compte aux droits insuffisants, une action affiche une alerte « Erreur » sans crash |
| Listes vides | Un état vide illustré (icône + texte) s'affiche, pas une page blanche |
| Chargement | Un spinner vert s'affiche pendant le chargement |
| Multi-association | Changer d'association puis revenir au bureau → les données correspondent à la bonne association |
| Espace membre intact | Les 5 onglets membres fonctionnent toujours comme avant (aucune régression) |

---

## 6. Checklist de synthèse

- [ ] 4.1 Dashboard
- [ ] 4.2 Membres (4 onglets)
- [ ] 4.3 Fiche membre + actions
- [ ] 4.4 Invitations
- [ ] 4.5 Approbations (liste + détail + flux 2 comptes)
- [ ] 4.6 Finance (4 onglets)
- [ ] 4.7 Détail cotisation (valider/rejeter/correction)
- [ ] 4.8 Détail prêt (approuver/contre-offre)
- [ ] 5. Tests transverses (gating, retours, états vides, multi-asso, non-régression)

---

## 7. Modules avancés (Phases 5 → 8 — désormais livrés)

> Toutes les tuiles du dashboard sont maintenant actives. Tests par module ci-dessous.

### 7.1 Cycles & séances (tuile **Cycles**)
**Accès :** Dashboard → Cycles (3 onglets : Cycles / Cagnottes / Distributions)
- [ ] **Cycles** : créer un cycle (Nom + date `AAAA-MM-JJ`) → apparaît dans la liste
- [ ] Taper un cycle → détail : stats, **Générer les séances**, liste des séances
- [ ] **Clôturer le cycle** (cycle actif) → crée une approbation `cycle.close` (triple validation)
- [ ] Taper une séance → détail :
  - [ ] **Présences** : pour chaque membre, boutons P / A / E mettent à jour le statut
  - [ ] **Cagnottes** : « Ouvrir la cagnotte — {tontine} » crée un pot ; taper un pot → détail
  - [ ] **Clôturer la séance** → rapport ; **Annuler la séance** → approbation `session.cancel`
- [ ] **Détail cagnotte** : stats (disponible/distribué/reliquat), candidats éligibles → **Distribuer** (ou **Attribuer** en mode enchère après saisie du montant), **Clôturer la cagnotte**
- [ ] **Distributions** : liste en lecture des versements

### 7.2 Gouvernance (tuile **Gouvernance**)
**Accès :** Dashboard → Gouvernance (4 onglets)
- [ ] **Annonces** : publier (titre + contenu) → apparaît dans la liste — `POST /governance/announcements/`
- [ ] **Sondages** : créer (titre + question + options séparées par virgules) ; **Ouvrir** / **Clôturer** un sondage
- [ ] **Élections** : créer une élection (scrutin secret) → liste avec statut
- [ ] **Documents** : ajouter (titre + contenu) ; supprimer (corbeille)

### 7.3 Sanctions (tuile **Sanctions**)
**Accès :** Dashboard → Sanctions (3 onglets)
- [ ] **Sanctions** : liste des sanctions appliquées (montant + statut)
- [ ] **Types** : créer un type (nom + montant par défaut)
- [ ] **Appliquer** : choisir un membre (recherche), un type, un motif → **Sanctionner** — `POST /sanctions/sanctions/`

### 7.4 Portefeuilles (tuile **Portefeuilles**)
**Accès :** Dashboard → Portefeuilles (2 onglets)
- [ ] **Comptes membres** : hero total + liste des wallets ; bouton **recalculer** par compte (gated)
- [ ] **Ajustement** : choisir membre + sens (crédit/débit) + montant + motif → soumet un ajustement (validation bureau) — `POST /wallets/manual-adjustment/`

### 7.5 Procurations (tuile **Procurations**)
**Accès :** Dashboard → Procurations
- [ ] Liste des procurations ; les **pending** ont ✓/✗ (approuver/rejeter) — `POST /proxies/{id}/approve|reject/`

### 7.6 Paramètres (tuile **Paramètres**, surtout Président)
**Accès :** Dashboard → Paramètres (4 onglets)
- [ ] **Rôles** : créer / supprimer un rôle (les rôles système ne sont pas supprimables)
- [ ] **Postes** : créer / supprimer un poste de bureau
- [ ] **Approbations** : pour chaque action, changer la règle (Unanimité / Majorité / Président) — `PATCH /approvals/policies/{action_type}/`
- [ ] **Prêts** : modifier taux / durée max / réserve de trésorerie → **Enregistrer** (lecture seule si non autorisé)

### 7.7 Discussion (tuile **Discussion**)
- [ ] Ouvre la messagerie existante (chat) — le canal « Bureau » y est listé.

> ⚠️ Rappel : beaucoup de ces actions (clôture cycle, annulation séance, ajustement wallet) passent par le **moteur d'approbations** (§4.5) — vérifier que la demande apparaît bien dans **Approbations**.

---

## 8. Que faire en cas d'anomalie
- Noter : écran, onglet, action, message d'erreur exact, et si l'API a été appelée (regarder la console Metro / réseau).
- Distinguer **erreur d'UI** (crash, écran blanc) d'un **refus métier** (alerte « Erreur » = souvent un 400/403 backend légitime).
- Les libellés d'actions d'approbation sont dans `src/lib/bureau/approval-labels.ts` ; les statuts finance dans `finance-labels.ts`.
