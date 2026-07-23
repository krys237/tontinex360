# Audit de conformité Google Play / App Store — TontineX360 mobile

**Date de l'audit :** 2026-07-20
**Version auditée :** `app.json` → `1.1.0`, `versionCode 3`, package `com.tontinex360.app`
**Périmètre :** `tontinex360_mobile/` (app React Native / Expo) + vérifications backend dans `tontine_project/`
**Cible :** Google Play en priorité, App Store anticipé (l'app n'est pas encore distribuée sur iOS)

> Méthode : quatre audits indépendants et parallèles (permissions/manifest, données personnelles,
> politique financière, qualité & fiche store). Chaque constat ci-dessous est sourcé par un
> `fichier:ligne`. Rien n'a été supposé sans vérification ; les points cherchés et non trouvés
> sont signalés comme tels.

---

## 0. Verdict en une phrase

**L'app ne peut pas être soumise en l'état** : 8 bloquants, dont 3 techniques (build, auto-update,
signature), 3 juridiques (politique de confidentialité, suppression de compte, compte de démo) et
1 faille de sécurité backend critique. Aucun n'est structurel — le code est sain, c'est
l'emballage de publication qui manque.

Le bon angle de défense, cohérent avec ce que fait réellement le code :
**TontineX360 est un logiciel de comptabilité associative, pas une application financière.**
Tout ce qui contredit visuellement ce message dans l'UI ou la fiche est à corriger.

---

## 1. Tableau de bord

| # | Sujet | Gravité | Effort | Dépend de |
|---|---|---|---|---|
| B0 | `UserViewSet` sans permission → fuite + suppression de tous les comptes | 🔴 **CRITIQUE** | S | Dev backend |
| B1 | Aucun profil EAS ne produit un AAB | 🔴 Bloquant | S | — |
| B2 | Mise à jour APK hors store embarquée dans l'app | 🔴 Bloquant | S | — |
| B3 | Build release signé avec la clé de **debug** | 🔴 Bloquant | S | — |
| B4 | Aucune politique de confidentialité (ni page, ni lien) | 🔴 Bloquant | M | Page web |
| B5 | Aucune suppression de compte (in-app ni web) | 🔴 Bloquant | M | Dev backend |
| B6 | Aucun compte de démo — app 100 % verrouillée derrière OTP SMS | 🔴 Bloquant | M | Dev backend |
| B7 | Icône source non carrée (1068×909), assets store absents | 🔴 Bloquant | S | Design |
| R1 | Prêts avec intérêt 5-20 % sans durée ni APR affiché | 🟠 Risque élevé | M | — |
| R2 | `RECORD_AUDIO` + `SYSTEM_ALERT_WINDOW` déclarées, jamais utilisées | 🟠 Risque | S | — |
| R3 | Photos de preuve uploadées sans strip EXIF (GPS implicite) | 🟠 Risque | S | — |
| R4 | Lexique « tirage au sort » / « enchère » → filtre gambling | 🟠 Risque | S | — |
| R5 | Boutons Google/Apple SSO non fonctionnels (placeholders visibles) | 🟠 Risque | S | — |
| R6 | Abonnement SaaS — bloquant le jour où le paiement est branché | 🟠 Risque | — | Arbitrage |
| R7 | Aucun ErrorBoundary → écran blanc sur exception de rendu | 🟠 Risque | S | — |
| R8 | Token FCM jamais révoqué au logout | 🟠 Risque | S | Dev backend |
| R9 | Icône de notification Android absente → carré blanc | 🟠 Risque | S | Design |
| M1-M6 | Divers (versionCode désynchronisé, `console.log`, `supportsTablet`, `allowBackup`…) | 🟡 Mineur | S | — |

Effort : S = moins d'une heure · M = une demi-journée à quelques jours

---

## 2. 🔴 CRITIQUE — hors sujet store, à traiter aujourd'hui

### B0 — `UserViewSet` exposé sans aucune permission

```python
# tontine_project/apps/core/views.py:542-544
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
```

Aucun `permission_classes`, aucun filtrage du queryset. Et `config/settings/base.py:226-239`
définit `REST_FRAMEWORK` **sans** `DEFAULT_PERMISSION_CLASSES` → DRF retombe sur `AllowAny`.
Le routeur l'enregistre (`apps/core/urls.py:16`) et l'expose sous **deux** préfixes
(`config/urls.py:31,34`).

Conséquence, **sans authentification** :
- `GET /api/auth/user/` → liste tous les utilisateurs (nom, prénom, téléphone, email)
- `DELETE /api/auth/user/{id}/` → supprime n'importe quel compte
- `PATCH /api/auth/user/{id}/` → modifie n'importe quel compte

C'est une violation de la politique Play sur les données utilisateur, mais surtout une faille
active en production, indépendante de toute question de store.

**Action (dev backend) :** retirer `UserViewSet` du routeur ou le restreindre
(`permission_classes = [IsAuthenticated]` + `get_queryset()` limité à `request.user`), et ajouter
un `DEFAULT_PERMISSION_CLASSES: ['rest_framework.permissions.IsAuthenticated']` global.

---

## 3. 🔴 Bloquants techniques (côté mobile, autonomes)

### B1 — Aucun profil EAS ne produit un AAB

`eas.json:6-18` : les deux profils, `preview` **et** `production`, sont en
`"buildType": "apk"` + `"distribution": "internal"`. Le bloc `"submit": { "production": {} }`
(`eas.json:19-21`) est vide — ni `serviceAccountKeyPath`, ni `track`.

Google Play n'accepte que l'Android App Bundle pour toute nouvelle app (depuis août 2021), et
`distribution: internal` ne génère pas un build soumissible.

**Action :** créer un profil `production` en `"distribution": "store"` sans `buildType`
(le défaut EAS est déjà `app-bundle`), et conserver `preview` en APK pour la distribution directe
actuelle. Renseigner ensuite `submit.production` avec la clé de service Play Console.

### B2 — Mise à jour APK hors store embarquée dans l'app

Le mécanisme est complet et actif :

| Élément | Emplacement |
|---|---|
| Montage global | `src/App.tsx:9,76` — `<UpdateGate />` |
| Comparaison de version | `src/components/UpdateGate.tsx:26-27` |
| Manifeste distant | `src/lib/api/app-version.ts:39-44`, `src/config/env.ts:24-25` |
| **Ouverture de l'APK** | `src/components/UpdateAvailableModal.tsx:38-40` — `Linking.openURL(info.apk_url)` |
| **Modal non fermable** | `src/components/UpdateAvailableModal.tsx:52,65-70` (mode `mandatory`) |
| URL cible | `app-version.json:6` → GitHub Releases `.apk` |
| Documentation | `docs/GUIDE_RELEASE_ET_MISES_A_JOUR.md` §1, §6 |

La politique **Device and Network Abuse** interdit à une app distribuée sur Play de télécharger ou
d'installer du code exécutable hors du store. Une modale bloquante « Mise à jour requise » pointant
vers un `.apk` est un motif de rejet direct — et de suspension du compte développeur en cas de
récidive.

À noter : `REQUEST_INSTALL_PACKAGES` est **absente** du manifest et de `app.json` — l'app délègue
au navigateur, elle n'installe pas elle-même. Cela ne change pas le verdict, mais réduit la gravité
perçue.

**Action :** conditionner `UpdateGate` à un flag de build « canal hors-store ». Le plus simple est
documenté dans le code lui-même (`src/config/env.ts:23`) : `APP_VERSION_MANIFEST_URL = ''` suffit à
neutraliser le gate. Ne **pas** supprimer le mécanisme — la distribution APK directe reste en place
en parallèle. Si un gating de version reste souhaité sur le canal Play, rediriger vers
`market://details?id=com.tontinex360.app`.

### B3 — Le build release est signé avec la clé de debug

```gradle
// android/app/build.gradle:112-115
release {
    signingConfig signingConfigs.debug
}
```

Seul `signingConfigs.debug` existe (`android/app/build.gradle:100-107`, `storeFile file('debug.keystore')`),
et aucun keystore de release n'est présent dans `android/app/`. Or le `README.md` documente
`cd android && ./gradlew assembleRelease` — cette commande produit donc un artefact debug-signé que
Play refuse.

**Action :** builder via EAS (le keystore de release est géré côté Expo, signature stable garantie).
Pour un build local, créer un `signingConfigs.release` alimenté par `gradle.properties` — les `*.jks`
sont déjà gitignorés (`.gitignore:19`).

### B7 — Icône source non carrée, assets store absents

`src/assets/logo/logo-icon.png` mesure **1068×909** et sert simultanément de `icon`, `splash.image`
et `android.adaptiveIcon.foregroundImage` (`app.json:8,11,20`). Le prebuild l'étire ou la rogne.

**Action (design) :** produire `icon.png` 1024×1024, `adaptive-icon.png` 1024×1024 (zone sûre 66 %),
`icon-512.png` pour la fiche, et un feature graphic 1024×500.

---

## 4. 🔴 Bloquants juridiques / process

### B4 — Aucune politique de confidentialité

Recherché `confidentialit|privacy|politique|cgu|conditions g|terms|mentions l` sur tout `src/` :
les seules occurrences sont du **texte mort**.

- `src/screens/auth/InviteAcceptScreen.tsx:111-113` — « En continuant, vous acceptez nos Conditions
  d'utilisation et notre Politique de confidentialité. » : simple `<Text>`, aucun `onPress`, aucune URL.
- `src/screens/auth/InviteAcceptScreen.tsx:170-171` — un `<Text style={styles.link}>` **stylé comme
  un lien** mais sans handler.
- `src/screens/app/ProfileScreen.tsx:229` — ouvre `soon("Conditions d'utilisation")` → une `Alert`
  « Cette fonctionnalité arrive bientôt » (`ProfileScreen.tsx:124`).

L'URL de politique de confidentialité est un **champ obligatoire** de Play Console.

**Action :** publier une politique réelle sur une URL publique couvrant l'inventaire de données du
§6, la déclarer en Play Console, et l'exposer dans l'app (Profil → À propos). Brancher aussi le lien
CGU de `InviteAcceptScreen.tsx:171`.

### B5 — Aucune suppression de compte

Vérifié des deux côtés :
- **Mobile** : aucun écran, bouton ou appel API. `SecurityScreen.tsx:77` n'offre que « Changer le mot
  de passe » ; `ProfileScreen.tsx:234` et `SecurityScreen.tsx:49,95` n'offrent que la déconnexion.
  Les « Supprimer » trouvés portent sur des documents, annonces, événements et types de sanction.
- **Backend** : `apps/core/urls.py:19-41` liste tous les endpoints auth — register, login,
  token/refresh, valid-otp, resend-otp, change-fogot-password, change-password, me,
  register-fcm-token, associations/* — **aucun** endpoint de suppression ou désactivation.
  Recherché `delete_account|delete-account|supprimer.?compte|deactivate|désactiv|account_deletion|destroy`.
- **URL web** : aucune. Les 6 `Linking.openURL` de l'app pointent vers des PDF de reçus, des pièces
  jointes et l'APK de mise à jour.

L'app permet la création de compte (`RegisterScreen.tsx:55-57` → `POST /auth/register/`), donc la
règle Google Play (obligatoire depuis 2023-2024) et Apple 5.1.1(v) s'appliquent pleinement.

**Action :**
1. *(dev backend)* endpoint `DELETE /api/auth/me/` avec **anonymisation** — les écritures
   comptables et financières devront être conservées sous forme anonymisée, ce qui doit être
   documenté dans la politique de confidentialité.
2. Écran « Supprimer mon compte » dans `SecurityScreen.tsx`, double confirmation, explication
   claire de ce qui est supprimé vs conservé.
3. Page web publique de demande de suppression, accessible **sans installer l'app**, à déclarer
   en Play Console.

### B6 — Aucun compte de démo, app entièrement verrouillée

`src/navigation/RootNavigator.tsx:16` : hors session, seule la stack Auth est montée. Le login se
fait par téléphone + **OTP SMS** (`VerifyOtpScreen.tsx`). Un reviewer ne recevra jamais le SMS.

Rejet quasi certain chez Apple (Guideline 2.1), et blocage de la review côté Google.

**Action (dev backend) :** compte de démo avec OTP fixe ou bypass, alimenté avec des données
réalistes, transmis dans les notes de review des deux stores.

---

## 5. 🟠 Risques — politique de contenu financier

### Constat structurant : l'app ne transfère aucun argent

C'est le point le plus important de tout l'audit, et il joue en votre faveur. Vérifié
exhaustivement :

- `requests.post|requests.get` sur tout `tontine_project/apps/` → **2 fichiers, aucun financier** :
  `apps/core/utils.py:90` (UltraMsg, SMS/WhatsApp) et `apps/chat/jitsi_utils.py:3` (visio).
- **Aucune clé d'agrégateur** dans `config/settings/` (cherché MOMO, MTN, ORANGE, STRIPE, CAMPAY,
  FAPSHI, FLUTTERWAVE, NOTCHPAY, PAYUNIT) — seulement `DJANGO_SECRET_KEY` et `JITSI_API_KEY`
  (`config/settings/base.py:18,289`).
- **Aucune route webhook/callback.** `apps/subscriptions/urls.py:27` n'expose qu'un
  `payments/<uuid>/confirm/` protégé par `IsAuthenticated`.
- **Aucun SDK de paiement** dans `package.json` : ni `react-native-iap`, ni `@stripe/*`, ni
  `expo-in-app-purchases`, ni mobile money. `react-native-webview` n'est qu'une dépendance native de
  `react-native-signature-canvas`, jamais instanciée.
- Les mentions « momo » / « Orange Money » sont des **libellés** : `apps/finance/services.py:161`,
  `CotiserScreen.tsx:32`.

Chaque « paiement » est une **déclaration + photo de reçu**, validée ensuite par le trésorier :
`CotiserScreen.tsx:148` refuse l'envoi sans preuve, le bouton `:371` dit « Envoyer la preuve » (pas
« Payer »), et le backend force `status='submitted'`, `is_validated=False` → **aucune écriture
comptable** (`apps/finance/models.py:60-73`).

**Conséquence :** l'app ne déclenche ni les exigences « services financiers » de Google Play, ni
Apple 3.2.1. Répondre **NON** à « facilite les paiements / transferts de fonds » dans le
questionnaire Play Console.

**Action recommandée :** ajouter un **disclaimer visible** (écran Cotiser + À propos) :

> TontineX360 est un outil de gestion et de comptabilité. L'application n'effectue aucun transfert
> d'argent ; les paiements se font hors application entre membres.

C'est la meilleure défense en cas de review manuelle.

### R1 — Prêts : le risque #1 de rejet

| Fait | Preuve |
|---|---|
| Taux d'intérêt réel, défaut **5 %**, plafond **20 %** | `apps/finance/models.py:228`, `apps/finance/loan_settings.py:26-28`, validé `apps/finance/views.py:797-804` |
| Formule `total_due = amount × (1 + rate/100)` | `apps/finance/loan_workflow.py:25-29` |
| **Intérêt forfaitaire, non prorata temporis** → aucun APR calculable | idem — aucune dépendance à la durée |
| Prêteur = **la caisse de l'association**, pas un tiers | `Loan` n'a pas de champ prêteur (`models.py:219`) ; décaissement depuis la trésorerie `apps/approvals/handlers.py:730-783` |
| Intérêts **redistribués aux membres** au prorata | `apps/wallets/services.py:227-276` |
| Capacité bornée à 70 % de la trésorerie | `apps/finance/loan_capacity.py:9-10` |
| `due_date` **purement déclarative** — jamais comparée à `now()` | `models.py:235` |
| **Aucune pénalité de retard** | grep `overdue\|late\|penalt` sur finance+cycles → rien |

La *Personal Loans policy* de Google vise les apps qui **facilitent l'octroi** de prêts personnels.
Ici : pas de décaissement in-app, et un mécanisme mutualiste interne entre une association et ses
propres membres. **Mais** un reviewer qui voit « prêt » + « taux 5-20 % » + « Cameroun » applique la
politique par défaut. Un rejet initial est probable ; c'est gagnable en appel à condition d'avoir le
matériel prêt.

**Actions, par ordre d'efficacité :**
1. **Afficher durée et total dû.** C'est le point le plus faible : un taux sans durée. Rendre
   `due_date` obligatoire et afficher sur l'écran de demande et de détail : montant accordé, taux,
   **montant total dû, échéance**, absence de frais, absence de pénalité de retard. Même hors
   politique, cela neutralise l'objection.
2. **Renommer dans l'UI** : « avance sur caisse » ou « crédit interne à l'association » plutôt que
   « prêt » — réduit fortement le déclenchement des filtres automatiques.
3. Déclarer en Play Console que l'app **ne fournit ni ne facilite de prêts personnels** : outil de
   comptabilité pour une association d'épargne mutuelle, sans décaissement in-app.
4. Préparer une **note de contexte d'une page** expliquant le modèle tontine/ROSCA, à joindre en appel.

### R4 — Enchères : pas du gambling, mais mal nommé

Faits : on enchérit sur le droit de recevoir la cagnotte de la séance — l'ordre de bénéficiaire
d'une tontine rotative (`apps/cycles/models.py:666-727`). Attribution **100 % déterministe** (plus
haute mise, `AuctionsScreen.tsx:96-98` ; attribution finale par le bureau avec
`winner_membership_id` explicite). **Aucune mise d'argent réelle** — `placeBid` envoie du JSON sans
preuve ni paiement (`AuctionsScreen.tsx:119-125`) ; le gagnant paie sa prime par retenue sur son lot
(`apps/cycles/payout_calc.py:95-103`), prime plafonnée au lot. **Aucune perte possible, aucun aléa** :
chaque membre reçoit le pot une fois par cycle, l'enchère ne change que l'ordre.

Point notable : le mode `random` n'existe **qu'en libellé d'énumération** — grep
`import random|random\.|shuffle|choice(` sur tout `apps/` → **zéro occurrence**. Le tirage se fait
hors système, l'app enregistre le résultat.

Ce n'est donc pas un jeu d'argent. Le risque est **purement lexical**.

**Actions :**
- Bannir « tirage au sort », « pari », « gagner » de la fiche Play, de la description et des captures.
  Préférer « ordre d'attribution », « désignation du bénéficiaire », « offre ».
- Corriger `src/lib/bureau/cycle-labels.ts:74` et `BureauCyclesScreen.tsx:161`, qui affichent
  aujourd'hui « Attribution automatique des bénéficiaires par tirage au sort » — c'est à la fois
  **faux** (le code ne tire rien) et un déclencheur de filtre gambling.
- Questionnaire Play : NON à « jeux d'argent et de hasard ».

### R6 — Abonnement SaaS : OK aujourd'hui, piège demain

État actuel : **aucun écran d'achat côté mobile**. Pas de paywall, pas de `SubscriptionScreen`.
`SubscribeModal.tsx:98` est un faux ami (souscription à une *tontine*). Les champs
`subscription_status` / `trial_end` remontent de l'API (`src/lib/api/auth.ts:94-95`) mais ne sont
**affichés nulle part**.

Backend : abonnement payé par **l'association** (1:1 avec `Association`,
`apps/subscriptions/models.py:57-58`), action réservée au président/fondateur
(`apps/subscriptions/views.py:38-66`), grille XAF 3 000 → 75 000/mois
(`seed_plans.py:30-97`), trial 90 j. Paiement **déclaratif** : `initiate_payment` crée un `Payment`
PENDING sans appel réseau (`services.py:52-83`) ; `confirm_payment` est manuel avec
`provider_reference` saisi à la main (`services.py:85-104`). Marqueurs explicites de placeholder :
`views.py:182-184`, `tasks.py:179-181`, `docs/SUBSCRIPTIONS_API.md:390`.

Tant que l'app mobile n'expose **aucun** achat ni lien vers un achat, Play Billing et Apple IAP ne
s'appliquent pas — vous êtes dans le cas « B2B / achat hors app » toléré.

**Le piège :** le jour où le « hub de paiement » est branché avec un écran d'upgrade in-app, vous
vendez une fonctionnalité numérique → **Play Billing et IAP deviennent obligatoires**, commission
15-30 %. Payer par mobile money depuis l'app = rejet quasi certain.

**Actions :**
- Court terme : ne **rien** exposer de l'abonnement côté mobile. Ni écran, ni bouton, ni lien, ni
  prix. Ne pas afficher `subscription_status`/`trial_end` avec un CTA.
- Attention à la **402 Payment Required** du `SubscriptionMiddleware` (`DOCUMENTATION.md:708`) : le
  message mobile doit rester « L'accès de votre association est suspendu. Contactez le président de
  votre association. » — **sans lien de paiement**.
- Long terme : le modèle B2B (l'association achète, via le web) est défendable comme achat par une
  entité juridique hors app. Zone grise chez Apple. **À arbitrer avant d'intégrer le hub, pas après.**

### Pays et devise

Devise **XAF/FCFA** en dur (`src/lib/utils/format.ts:17,24`), langue **française uniquement** (aucune
lib i18n, mois codés en dur `format.ts:41-44`), indicatif **+237 forcé** et non modifiable
(`LoginScreen.tsx:41`, `RegisterScreen.tsx:50`, `ForgotPasswordScreen.tsx:71,184`,
`PhoneField.tsx:32`, `BureauInvitationsScreen.tsx:83`).

**Action :** restreindre explicitement la distribution Play au **Cameroun** (éventuellement zone
CEMAC). Une app financière francophone à +237 codé en dur, distribuée mondialement, augmente
inutilement l'exposition aux politiques pays-spécifiques.

---

## 6. Données personnelles — inventaire pour le formulaire Data Safety

| Donnée | Saisie | Destination |
|---|---|---|
| Prénom, Nom | `RegisterScreen.tsx:31-32`, `EditProfileScreen.tsx:29-30` | `POST /auth/register/`, `PATCH /auth/me/` |
| Téléphone (identifiant du compte) | `RegisterScreen.tsx:33`, `LoginScreen.tsx:34` | `/auth/register/`, `/auth/login/`, `/auth/valid-otp/` |
| Email (optionnel) | `RegisterScreen.tsx:34`, `EditProfileScreen.tsx:31` | `/auth/register/`, `PATCH /auth/me/` |
| Mot de passe | `RegisterScreen.tsx:35-36`, `ChangePasswordScreen.tsx:28-30` | `/auth/register/`, `/auth/change-password/` |
| Photos (preuves de paiement) | `CotiserScreen.tsx:138`, `MesPretsScreen.tsx:129`, `MesSanctionsScreen.tsx:124`, `RegulariserScreen.tsx:113` | `/finance/contributions/`, `/finance/loans/{id}/repay/`, sanctions, corrections |
| Signature manuscrite + `device_info` | `SignatureModal.tsx:53`, `ProfileScreen.tsx:255` | `POST /members/memberships/{id}/signature/` |
| Données financières (montants, parts, méthode) | `CotiserScreen.tsx:161-169` | `/finance/contributions/` |
| Token FCM + type d'appareil | `src/lib/push/fcm.ts:49,58` | `POST /auth/register-fcm-token/` |
| Téléphone/email de tiers (invitations) | `src/lib/api/invitations.ts:15-16` | `POST /invitations/send/` |

**À déclarer « non collecté »** — vérifié absent : date de naissance, pièce d'identité / KYC
(`proxy_cni_number` existe comme *type* dans `src/lib/api/proxies.ts:19` mais **aucun champ n'est
rendu ni envoyé**, cf. `ProxyRequestModal.tsx:117-123`), adresse postale, genre, profession, numéro
mobile money (`mobile_money` n'est qu'une valeur d'énumération), contacts (`expo-contacts` absent),
géolocalisation (`expo-location` absent — les variables `location` de `BureauEventFormScreen.tsx:66`
sont des champs texte de lieu de réunion).

**SDK tiers à déclarer :** uniquement `@react-native-firebase/app` + `messaging` (FCM) et
`@notifee/react-native` (affichage local). Vérifiés **absents** : Firebase Analytics, Crashlytics,
Performance, Sentry, Bugsnag, Amplitude, Mixpanel, Segment, Facebook SDK, AppsFlyer, Adjust. Aucun
tracking publicitaire, aucun Advertising ID. **La déclaration Data Safety sera simple.**

### R3 — Photos uploadées sans strip EXIF

Les 4 écrans d'upload de preuve ne retirent pas les métadonnées EXIF. Une photo prise depuis la
galerie peut donc transmettre les **coordonnées GPS** du membre. Or l'app ne demande aucune
permission de localisation → la collecte serait **non déclarée et non consentie**.

**Action :** passer `exif: false` aux options `launchImageLibraryAsync` / `launchCameraAsync`
(correctif d'une ligne par écran), ou strip côté backend. À faire **avant** de figer la déclaration
Data Safety.

### R8 — Token FCM jamais révoqué au logout

`src/lib/push/fcm.ts:66-68` le documente explicitement : « Ne supprime rien côté serveur — l'API
n'expose pas de désenregistrement. Le token reste en base, associé à l'ancien user. » Sur un
appareil partagé, l'ancien utilisateur reste lié au device jusqu'au rejet FCM.

**Action (dev backend) :** `DELETE /auth/register-fcm-token/`, appelé dans `clearAuth()`.

### Points positifs vérifiés

- **Transport 100 % chiffré.** `src/config/env.ts:11-12` → `https://api.tontinex360.com/api` et
  `wss://api.tontinex360.com/ws`. Recherché `http://` dans tout `src/` : **aucune occurrence**. Pas
  de `usesCleartextTraffic`, pas de `networkSecurityConfig` → cleartext bloqué par défaut.
- **Tokens dans le Keystore/Keychain.** `src/lib/storage/secure-storage.ts:39-40,55-56` via
  `expo-secure-store`. AsyncStorage ne stocke que le slug d'association active (`:46,68`). Règles de
  backup dédiées excluant le store sécurisé (`secure_store_backup_rules`).
- **Aucune URL locale ni secret en dur.** Grep `localhost|127.0.0.1|192.168.|10.0.2.2|ngrok` sur
  `src/` + `index.js` + `app.json` = 0 résultat. `google-services.json` ne contient que des
  identifiants clients Firebase (public par nature, restreint par package + signature).
- **Robustesse réseau correcte.** Timeout axios 30 s (`src/lib/api/client.ts:26`), message dégradé
  explicite (`src/lib/utils/errors.ts:10`), bootstrap en `try/finally` (`src/App.tsx:47-56`) → l'app
  démarre même API injoignable. UpdateGate et enregistrement push échouent silencieusement.

---

## 7. Permissions & manifest

> ⚠️ `android/` **n'est pas versionné** (`.gitignore:14`) — c'est un artefact de `expo prebuild`.
> `app.json` fait foi pour EAS. Le dossier local sur disque est périmé (cf. M1).

### ✅ targetSdk / compileSdk / minSdk — conformes et en avance

Chaîne de résolution tracée : `android/app/build.gradle:88,93-94` → `ExpoRootProjectPlugin.kt:28-30`
→ catalogue `expoLibs` → `node_modules/react-native/gradle/libs.versions.toml:3-6`.

**Valeurs effectives : minSdk 24, targetSdk 36, compileSdk 36.** Exigence Play : targetSdk 35 minimum
depuis le 31/08/2025, 36 attendu au 31/08/2026. **Conforme, et déjà aligné sur l'échéance 2026.**

### ✅ Aucune permission critique à déclaration Play Console

Manifest source exhaustif (`android/app/src/main/AndroidManifest.xml:2-9`) : CAMERA, INTERNET,
POST_NOTIFICATIONS, READ_EXTERNAL_STORAGE, RECORD_AUDIO, SYSTEM_ALERT_WINDOW, VIBRATE,
WRITE_EXTERNAL_STORAGE.

Vérifiées **absentes**, du manifest source et des manifests des libs autolinkées :
`QUERY_ALL_PACKAGES` (le bloc `<queries>` `:10-16` est ciblé VIEW/BROWSABLE/https — forme conforme),
`REQUEST_INSTALL_PACKAGES`, `MANAGE_EXTERNAL_STORAGE`, SMS/CALL_LOG, `ACCESS_BACKGROUND_LOCATION`,
`FOREGROUND_SERVICE`, `USE_FULL_SCREEN_INTENT`, `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`.
`@notifee/react-native` ne déclare aucune permission. `@react-native-firebase/messaging:5-7` ajoute
INTERNET, WAKE_LOCK, ACCESS_NETWORK_STATE — permissions normales.

### ✅ 64-bit et architectures

`android/gradle.properties:31` : `armeabi-v7a,arm64-v8a,x86,x86_64` → **arm64-v8a et x86_64 présents**.
Aucun `abiFilters` ni bloc `ndk {}`. `expo.useLegacyPackaging=false` (`:61`) → conforme AAB moderne.

### R2 — Deux permissions à retirer

| Permission | Preuve | Origine tracée | Usage réel |
|---|---|---|---|
| `RECORD_AUDIO` | `AndroidManifest.xml:6` | `expo-image-picker/plugin/build/withImagePicker.js:12` (ajoutée par défaut pour la capture vidéo) | **Aucun** — les 4 usages sont photo uniquement ; ni `expo-av` ni `expo-camera` en dépendance |
| `SYSTEM_ALERT_WINDOW` | `AndroidManifest.xml:7` | template Expo prebuild, `withAndroidBaseMods.js:64` | **Aucun** overlay dans `src/` |

Les deux sont très regardées en revue Play (micro très visible dans la fiche ; overlay = vecteur de
tapjacking, « special access ») et rendraient la déclaration Data Safety incohérente.

**Action :** `"microphonePermission": false` dans les options du plugin `expo-image-picker`
(`app.json:36-42`) pour `RECORD_AUDIO` ; config-plugin avec `tools:node="remove"` pour
`SYSTEM_ALERT_WINDOW`. **Ne pas éditer `android/` à la main** (regénéré au prebuild). Puis
re-prebuild et vérifier le manifest fusionné de l'AAB.

### Permissions justifiées (à conserver)

`CAMERA` → `launchCameraAsync` dans 4 écrans, rationales FR présentes (`app.json:39-40`).
`POST_NOTIFICATIONS` → `fcm.ts:33-36`. `VIBRATE` → notifee (`notifications.ts:52-58`).
`INTERNET` → axios. `READ_EXTERNAL_STORAGE` (`maxSdkVersion=32`) → `launchImageLibraryAsync`.
Aucune API localisation, contacts, SMS ou `READ_PHONE_STATE` dans `src/`.

### R-bis — Aucun `expo-build-properties`

Absent de `app.json:33-45` et de `package.json`. `android/gradle.properties` ne définit ni
`targetSdkVersion` ni `compileSdkVersion`. Le targetSdk hérite donc silencieusement du catalogue de
la version d'Expo/RN installée — favorable aujourd'hui, mais un downgrade de dépendance ferait
chuter le targetSdk **sans aucun signal**.

**Action :** ajouter `expo-build-properties` avec
`android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 24 }`.

---

## 8. Qualité & placeholders visibles

### R5 — Fonctionnalités placeholder exposées à l'utilisateur

`InviteAcceptScreen.tsx:100-109` affiche « Continuer avec Google » et « Continuer avec Apple » ; les
deux appellent `soon()` (`:52`) → Alert « Bientôt disponible ». Apple rejette les placeholders
(Guideline 2.1), et **un bouton Apple visible déclenche l'exigence Sign in with Apple**. Même
problème sur `ProfileScreen.tsx:206,228,230` (Langue, Aide & FAQ, À propos).

Plus grave, `InviteAcceptScreen` **collecte** téléphone `:38`, OTP `:39`, nom `:41`, prénom `:40`,
email `:42` et acceptation CGU `:43` — mais `finish()` (`:60-68`) **n'envoie rien** : l'appel API est
un TODO en commentaire (`:61-63`). Écran mort qui donne une fausse impression de consentement
recueilli.

**Action :** masquer les boutons non branchés, et retirer ou terminer `InviteAcceptScreen` avant
soumission.

### R7 — Aucun ErrorBoundary

Zéro occurrence de `ErrorBoundary` / `componentDidCatch` / `getDerivedStateFromError` dans `src/`.
Une exception de rendu en production = écran blanc, sans récupération possible.

**Action :** envelopper `RootNavigator` (`src/App.tsx:72-74`) dans un ErrorBoundary avec bouton
« Réessayer ».

### R9 — Icône de notification Android absente

Aucun `drawable*/ic_notification*` dans `android/app/src/main/res/`, et `app.json` n'en configure
aucune alors que RNFirebase + notifee sont actifs (`index.js:10`). Android ≥ 5 affichera un **carré
blanc**.

**Action (design) :** icône monochrome + `<meta-data com.google.firebase.messaging.default_notification_icon>`.

### Mineurs

- **M1 — versionCode désynchronisé.** `app.json:5,21` = `1.1.0` / `versionCode 3` ;
  `android/app/build.gradle:95-96` = `versionCode 2` / `1.0.1`. Sans impact via EAS (prebuild
  régénère), mais un `gradlew assembleRelease` local produirait un artefact 1.0.1/vc2, non
  installable par-dessus et refusé par Play. → Toujours `expo prebuild --clean` avant build local.
- **M2 — 6 `console.log` résiduels** : `src/lib/ws/use-chat-socket.ts` (5),
  `src/lib/bureau/search-catalog.ts` (2), plus `RegulariserScreen.tsx`, `MesSanctionsScreen.tsx`,
  `MesPretsScreen.tsx`. Sans impact review ; à nettoyer via un babel plugin en release.
- **M3 — `ios.supportsTablet: true`** (`app.json:15`) alors que les écrans sont conçus pour
  téléphone. Apple testera sur iPad et sanctionne les mises en page cassées. → `false` si l'iPad
  n'est pas visé (sinon captures tablette obligatoires).
- **M4 — `android:allowBackup="true"`** (`AndroidManifest.xml:17`) sur une app financière. Les
  secrets SecureStore sont exclus, mais le reste de l'AsyncStorage est sauvegardé vers Google Drive.
- **M5 — `expo-dev-client` en `dependencies`** (`package.json:27`) et non `devDependencies`. Vérifié
  sans impact permission (manifests dev-launcher/dev-menu vides, exclus du variant release) ; vérifier
  simplement que le build release n'affiche pas le menu dev.
- **M6 — `WRITE_EXTERNAL_STORAGE`** (`AndroidManifest.xml:9`, `maxSdkVersion="32"`) inerte sur les
  cibles modernes mais listée dans la fiche. Retirable si l'on veut une liste strictement minimale.
- **M7 — Clé API Firebase versionnée** (`google-services.json`). Normal et attendu pour une clé
  Android (restreinte par package + signature) ; vérifier que les restrictions d'application sont
  bien activées dans la console Google Cloud.
- **M8 — TODO fonctionnel** : `InviteAcceptScreen.tsx:61` — le wiring du token d'invitation par deep
  link n'est pas branché.

---

## 9. Inventaire fiche Play Console

| Élément | État |
|---|---|
| Titre (30 car.) | À rédiger — « TontineX360 » (11 car.) utilisable tel quel |
| Description courte (80 car.) | **Manque** — matière exploitable dans `README.md:3` |
| Description longue (4000 car.) | **Manque** — aucun texte marketing dans le repo |
| Icône 512×512 | **Manque** — source `logo-icon.png` non carrée (cf. B7) |
| Feature graphic 1024×500 | **Manque** |
| Captures téléphone (2 min., 1080×1920) | **Partiel** — 132 fichiers dans `capture/` (16 dossiers : dashbord, finances, membres, cycles, seances, wallets…), captures de travail à trier et recadrer |
| Captures tablette 7"/10" | **Manque** — obligatoire seulement si `supportsTablet` maintenu (cf. M3) |
| Vidéo promo | Optionnel, absent — **recommandé** ici pour montrer que « payer » = uploader une preuve |
| Catégorie | À décider — « Finance » |
| Classification de contenu (IARC) | À remplir — NON aux jeux d'argent (cf. R4) |
| Politique de confidentialité (URL) | **Manque — bloquant B4** |
| Formulaire Data Safety | À remplir — inventaire prêt au §6 |
| URL de suppression de compte | **Manque — bloquant B5** |
| Coordonnées développeur (email, tél., adresse) | **Manque** — aucune trace dans le repo |
| Compte de test pour la review | **Manque — bloquant B6** |
| Déclaration « Personal loans » | À remplir — argumentaire au §5 R1 |
| Déclaration « services financiers » | Répondre NON — preuves au §5 |
| Pays de distribution | À restreindre au Cameroun / CEMAC |
| AAB signé | **Manque — bloquants B1 + B3** |

---

## 10. Plan d'action ordonné

### Étape 0 — Immédiat, hors store
- [ ] **B0** — signaler `UserViewSet` au dev backend (faille active en production)

### Étape 1 — Build (quelques heures, aucune dépendance)
- [ ] **B1** — profil EAS `production` en `distribution: store` + AAB ; `preview` reste en APK
- [ ] **B2** — conditionner `UpdateGate` à un flag « canal hors-store »
- [ ] **B3** — builder via EAS (keystore géré) ou configurer un `signingConfigs.release`
- [ ] **R2** — retirer `RECORD_AUDIO` et `SYSTEM_ALERT_WINDOW`
- [ ] **R3** — `exif: false` sur les 4 écrans d'upload
- [ ] **R-bis** — ajouter `expo-build-properties` pour figer les SDK

### Étape 2 — À déléguer en parallèle (délai externe)
- [ ] **B5** — endpoint de suppression de compte avec anonymisation *(dev backend)*
- [ ] **B6** — compte de démo avec OTP bypass *(dev backend)*
- [ ] **R8** — `DELETE /auth/register-fcm-token/` *(dev backend)*
- [ ] **B4** — rédiger et publier la politique de confidentialité + page de suppression *(juridique / web)*
- [ ] **B7 / R9** — icône carrée 1024, feature graphic, icône de notification *(design)*

### Étape 3 — UI et lexique (avant les captures d'écran)
- [ ] **R1** — afficher durée, montant total dû et échéance sur les prêts ; envisager le renommage
- [ ] **R4** — corriger « tirage au sort » (`cycle-labels.ts:74`, `BureauCyclesScreen.tsx:161`)
- [ ] **R5** — masquer les boutons Google/Apple et les entrées `soon()`
- [ ] Disclaimer « l'app n'effectue aucun transfert d'argent » (Cotiser + À propos)
- [ ] Écran « Supprimer mon compte » + liens Politique/CGU réels
- [ ] **R7** — ErrorBoundary autour de `RootNavigator`

### Étape 4 — Fiche store
- [ ] Textes, captures triées et recadrées, assets
- [ ] Data Safety (§6), questionnaire IARC, déclarations financières (§5)
- [ ] Distribution restreinte au Cameroun
- [ ] Premier envoi en **test interne**, jamais directement en production

### Arbitrage à porter séparément
- [ ] **R6** — modèle de paiement de l'abonnement **avant** d'intégrer le hub de paiement
      (Play Billing / IAP vs achat web B2B). Décision structurante, coût 15-30 % si mal orientée.

---

## Annexe — ce qui a été vérifié et jugé conforme

Pour éviter de re-auditer : targetSdk/compileSdk/minSdk (36/36/24), architectures 64-bit, absence de
permission critique à déclaration, permissions restantes justifiées par le code, transport
HTTPS/WSS intégral, tokens en SecureStore, absence d'URL locale ou de secret en dur, périmètre SDK
tiers minimal sans tracker publicitaire, package name réel (`com.tontinex360.app`, aucun
placeholder), orientation portrait déclarée, bouton retour Android géré nativement, splash et
adaptive icon générés à toutes les densités, robustesse réseau au démarrage, textes de permission
runtime rédigés en français, sanctions/pénalités sans caractère de frais financier, absence de
transfert de fonds in-app, enchères déterministes sans aléa ni mise perdue.
