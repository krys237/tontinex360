# Fiche de test — Mise à niveau mobile (chantiers 1 à 5) — 23/07/2026

Backend cible : `https://api.tontinex360.com` (VPS/Caddy, branche master à jour).
Comptes nécessaires : **Bureau A** (président ou trésorier), **Bureau B** (autre membre du bureau), **Membre M** (membre simple), et idéalement un **Membre N** (deuxième membre simple).

Convention : ✅ = comportement attendu. Tout écart est un bug à remonter.

---

## Chantier 1 — Prêts (approbation directe, rejet, contre-offre, fonds source)

### 1.1 Approbation directe avec fonds source
1. Membre M : *Mes prêts* → *Demander un prêt* (montant dans la capacité).
2. Bureau A : *Finance* → onglet *Prêts* → le prêt est « En attente » → **Approuver** (depuis la liste ou le détail).
3. ✅ Une modale « Approuver et décaisser » s'ouvre avec le récap (membre, montant, taux, total dû) et la liste des fonds : « Trésorerie générale » (défaut, découvert autorisé) + chaque fonds avec son solde.
4. ✅ Un fonds dont le solde < montant est grisé avec la mention « insuffisant ».
5. Choisir un fonds suffisant → **Décaisser**.
6. ✅ Alerte « Prêt décaissé … depuis “<fonds>” », statut → « Décaissé », PLUS AUCUN passage par l'écran Approbations (pas de double validation).
7. ✅ Membre M reçoit la notification « Prêt approuvé ».
8. ✅ Trésorerie → vue par fonds : le solde du fonds choisi a baissé du montant du prêt.
9. Bureau A tente d'approuver SON PROPRE prêt → ✅ erreur « Vous ne pouvez pas approuver votre propre prêt. »

### 1.2 Rejet direct
1. Membre M : nouvelle demande de prêt.
2. Bureau A : détail du prêt → **Refuser le prêt** → motif optionnel → confirmer.
3. ✅ Statut → « Annulé » ; Membre M notifié « Prêt refusé » avec le motif.
4. ✅ Le bouton Refuser est disponible sur les statuts « En attente », « Contre-offre », « Attente garants » — pas après décaissement.

### 1.3 Contre-offre (bureau → membre)
1. Membre M : demande de prêt (ex. 100 000).
2. Bureau A : détail → **Faire une contre-offre** → montant STRICTEMENT inférieur (ex. 60 000).
   ✅ Le bouton « Proposer » est désactivé si montant ≥ montant demandé.
3. ✅ Statut → « Contre-offre » ; le détail bureau affiche « Contre-offre envoyée … en attente de sa réponse ».
4. Membre M : *Mes prêts* → ✅ bannière dorée « Le bureau propose 60 000 FCFA » + note éventuelle, boutons **Refuser** / **Accepter**.
5. Cas refus : **Refuser** → ✅ confirmation destructive explicite (« annulera définitivement votre demande ») → statut « Annulé ».
6. Cas acceptation : **Accepter** → ✅ alerte « Le bureau va procéder au décaissement », statut → « Approuvé », `total_due` recalculé sur 60 000.
7. ⚠️ **Limite backend connue (bug n°2 signalé)** : un prêt « Approuvé » après contre-offre n'est PAS décaissable (l'endpoint exige « en attente »). Tant que le fix backend n'est pas déployé, la chaîne s'arrête ici — c'est attendu côté mobile, bloquant côté serveur.

### 1.4 Statuts affichés
1. Faire vivre un prêt : décaissé → remboursement partiel validé → soldé.
2. ✅ Aucun prêt ne doit JAMAIS afficher « En attente » à tort : un prêt en cours de remboursement affiche « En remboursement » (y compris avec le statut backend hérité `partial`), un prêt soldé affiche « Remboursé » (y compris `completed`), un annulé « Annulé », une contre-offre « Contre-offre ».
3. ✅ Le bouton « Rembourser » (membre) apparaît pour un prêt décaissé OU en remboursement, jamais pour un prêt annulé/soldé.
4. ✅ Filtres de la liste bureau : « Contre-offre » et « Annulé » présents et fonctionnels.

---

## Chantier 2 — Régularisation d'un impayé (avec justificatif)

Pré-requis : Membre M a une cotisation en défaut (« Impayée ») sur une séance CLÔTURÉE (marquage à la clôture), avec la pénalité débitée sur son wallet.

### 2.1 Régularisation complète
1. Membre M : Accueil → *Régulariser* → la ligne « Impayée » affiche **Régulariser (payer + preuve)**.
2. ✅ La modale pré-remplit le montant avec le dû, propose la méthode (Mobile Money / Virement / Espèces) et EXIGE une photo (envoi bloqué sans preuve, montant plafonné au dû).
3. Envoyer → ✅ « Régularisation soumise … en attente de validation du bureau ». Aucun mouvement comptable à ce stade.
4. Bureau A : file des cotisations « À valider » → ✅ la soumission apparaît AVEC le justificatif photo visible.
5. Valider → ✅ la cotisation passe « Validée », la caisse est créditée, ET le débit de pénalité `contribution_default` du wallet de M est compensé.
6. ✅ Anti-self : si M est aussi du bureau, il ne peut pas valider sa propre régularisation.

### 2.2 Paiement partiel
1. Rejouer 2.1 avec un montant < dû.
2. ✅ Après validation, la ligne passe « Partielle » ; le reste dû est visible et complétable (top-up bureau).

### 2.3 Doublon propre
1. Membre M soumet une régularisation, puis re-tente sur la même ligne avant validation.
2. ✅ Message clair « Une cotisation existe déjà… (statut : Soumise) » — pas d'erreur 500.

### 2.4 Rejet sur séance close (demande de correction)
1. Sur une ligne « Rejetée » de séance CLÔTURÉE → bouton **Demander une correction**.
2. ✅ La modale ne propose PLUS de sélecteur photo (le serveur ne stocke pas de fichier sur ce flux) ; montant + motif (≥ 5 caractères) obligatoires ; mention « président + un membre du bureau, sous 24 h ».
3. ✅ Une demande en cours bloque les deux boutons (« Demande en cours »).
4. Rejet sur séance OUVERTE → ✅ toujours « Re-cotiser cette séance » (renvoi vers Mes tontines).

---

## Chantier 3 — Présences (self check-in + politique de pointage)

### 3.1 Politique (bureau)
1. Bureau A : détail d'une séance → onglet *Présences* → panneau **Politique de pointage** (replié, résumé visible).
2. Déplier → passer en mode **Auto**, marge **1 min**, self check-in **activé** → Enregistrer.
3. ✅ « Politique enregistrée » ; le résumé affiche « Auto · retard après 1 min ».
4. ✅ Un membre simple ne voit pas ce panneau ; un PATCH direct hors bureau est refusé serveur (403).

### 3.2 Self check-in à l'heure / en retard
1. Bureau A : ouvrir la séance (statut « En cours », avec une heure de début renseignée).
2. Membre M (dans la marge) : détail de la séance → ✅ bouton **« Je suis présent·e »** + mention de la marge → cliquer.
3. ✅ Alerte « Arrivée à HHhMM — votre présence est confirmée » ; la carte « Ma présence » affiche « Présent » + l'heure.
4. Membre N (après la marge) : ✅ « … comptée en retard (marge dépassée) » ; statut « En retard ».
5. ✅ Côté bureau, l'émargement montre les deux statuts posés automatiquement.

### 3.3 Idempotence et priorité bureau
1. Membre M re-clique (ou relance l'écran et re-pointe).
2. ✅ L'heure d'arrivée initiale ne bouge pas ; le statut ne se dégrade pas.
3. Bureau A pose « Excusé » sur Membre N ; N re-pointe.
4. ✅ Le statut « Excusé » décidé par le bureau est CONSERVÉ (l'auto-pointage ne l'écrase jamais).

### 3.4 Garde-fous
1. Séance « Programmée » ou « Terminée » → ✅ pas de bouton de pointage (et un POST direct renverrait « la séance n'est pas ouverte »).
2. Politique self check-in désactivée → ✅ le bouton disparaît, remplacé par « Le pointage individuel est désactivé : le bureau enregistre les présences. »
3. Mode **Manuel** : le membre pointe → ✅ statut « Présent » + heure enregistrée, message « Le bureau confirmera votre statut ».
4. Séance clôturée → ✅ présences figées, y compris pour le bureau (erreur serveur explicite).

---

## Chantier 4 — Retraits de trésorerie

Accès : Bureau → *Trésorerie* → tuile **Retraits** (ou recherche bureau : « retrait », « dépense »).

### 4.1 Création + double validation
1. Bureau A : **Nouveau retrait** → fonds précis, montant ≤ solde, motif ≥ 5 caractères, cocher **Remboursable** → **Créer et soumettre**.
2. ✅ Alerte « Retrait soumis … double validation », statut « En attente validation ». LE SOLDE DU FONDS N'A PAS BOUGÉ.
3. ✅ La demande apparaît dans *Approbations* sous le libellé « Retrait de trésorerie » (l'auto-vote du créateur compte comme 1ʳᵉ signature).
4. Bureau B : approuve la demande.
5. ✅ Statut du retrait → « Appliqué » ; le solde du fonds a baissé ; chaque membre actif a une dette (part égale) sur son wallet (`WITHDRAWAL_DEBT`).

### 4.2 Parts et remboursement
1. Déplier le retrait appliqué (chevron — uniquement si remboursable ET appliqué).
2. ✅ Liste des parts : membre, part, remboursé, restant + total restant dû.
3. **Rembourser** sur un membre → modale plafonnée au reste dû → montant partiel → Enregistrer.
4. ✅ Alerte avec le reste dû ; le fonds source est RECRÉDITÉ du montant ; wallet du membre crédité en « Remboursement de retrait ».
5. Solder la part → ✅ check vert à la place du bouton.
6. ✅ Un montant > reste dû est bloqué côté mobile (helper « Plafonné… »).
7. ⚠️ Ne pas marteler le bouton (bug backend n°5 signalé : double-submit réseau = double crédit ; le bouton se désactive pendant l'envoi).

### 4.3 Garde de solde et refus
1. Créer un retrait remboursable ou non d'un montant > solde du fonds → ✅ avertissement à la création (« le débit sera refusé à l'application ») ; la création passe, mais l'APPLICATION échoue à la validation avec l'erreur serveur de solde insuffisant.
2. Bureau B REJETTE une demande de retrait → ✅ le retrait reste non appliqué, aucun mouvement.
3. Coupure réseau simulée entre création et envoi de la demande → ✅ le retrait « En attente validation » garde un bouton **Soumettre à validation** ; re-soumettre une demande déjà en cours → ✅ erreur propre « déjà en cours sur cette cible » (pas de doublon).
4. ✅ Un membre simple ne voit ni « Nouveau retrait » ni « Rembourser » (et le serveur refuse ses POST).

---

## Chantier 5 — Finitions (ventilation, poids, invitation par code)

### 5.1 Ventilation par source (Trésorerie → vue par fonds)
1. Bureau : *Trésorerie* → **Vue par fonds** → taper une ligne de fonds.
2. ✅ La ligne se déplie : bloc « Par source » (Cotisations, Sanctions, Prêts, Dépenses… avec net signé, rouge si négatif).
3. ✅ Le bloc « Non affecté » se déplie aussi avec sa propre ventilation.
4. ✅ En bas : carte « Par source (toute la trésorerie) » = synthèse globale (net + crédit/débit par source).
5. ✅ Cohérence : total virtuel = total physique ; la somme des nets par source d'un fonds = solde du fonds.

### 5.2 Poids des membres
1. Dans le dépliage d'un fonds → bloc **« Poids des membres »**.
2. ✅ Chaque membre apparaît avec son apport cumulé et son % (tri décroissant), sous-titre « Base du partage des intérêts de prêt ».
3. Croisement métier : après validation d'un remboursement de prêt AVEC intérêts sur un prêt décaissé depuis ce fonds → ✅ l'intérêt distribué aux wallets suit ces poids (prorata), pas un partage égal.

### 5.3 Invitation par code/lien (utilisateur connecté)
1. Bureau A : envoyer une invitation (module Invitations) et récupérer le lien.
2. Utilisateur connecté SANS cette association : espace de travail → *Rejoindre une association* → carte **« J'ai reçu une invitation »** → coller le LIEN COMPLET (ou juste le token) → **Vérifier**.
3. ✅ Aperçu : nom de l'association, « Invité par … », rôle, message éventuel.
4. **Accepter l'invitation** → ✅ « Bienvenue ! », retour à la liste des associations où la nouvelle association APPARAÎT sans se reconnecter → on peut y entrer.
5. Token expiré/déjà utilisé → ✅ « Cette invitation a expiré ou a déjà été utilisée. » ; token bidon → ✅ « Invitation introuvable… ».
6. ✅ La recherche classique + demande d'adhésion reste disponible sous la carte (« Ou recherchez une association : »).
7. Limite assumée (backlog) : un invité SANS compte ne peut pas encore finaliser depuis le wizard d'invitation (deep link `tontinex360://` non câblé) — le wizard l'oriente vers le parcours ci-dessus après création de compte classique.

---

## Rappels backend bloquants/liés (déjà transmis au dev backend)
1. **Prêt APPROVED in-décaissable** après contre-offre acceptée / allocation → bloque la fin du flux 1.3.
2. Statuts hors énumération `'partial'`/`'completed'` (mobile les tolère, à normaliser).
3. `total_due` non recalculé serveur à la création (intérêts contournables).
4. POST direct `loan-repayments` = PAID sans comptabilité.
5. Remboursement de retrait non idempotent (double-submit = double crédit).
6. `request-correction` n'accepte pas de fichier (preuve impossible sur les corrections).
