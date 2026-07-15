# Guide de release & mises à jour (hors store) — TontineX360 mobile

Ce document décrit **comment publier une nouvelle version de l'app Android** et
**comment l'app détecte qu'une mise à jour existe**, tant que l'app n'est pas
sur le Play Store.

---

## 1. Comment fonctionne la détection de version

- L'app lit **sa propre version** dans `app.json` → `expo.version`
  (constante `APP_VERSION`, `src/config/env.ts`).
- Au démarrage, elle télécharge un **manifeste JSON** hébergé :
  ```
  https://raw.githubusercontent.com/krys237/tontinex360/master/tontinex360_mobile/app-version.json
  ```
  (constante `APP_VERSION_MANIFEST_URL`, `src/config/env.ts`).
- Elle compare sa version à `latest_version` du manifeste :
  - version installée **<** `latest_version` → **fenêtre « Mise à jour disponible »** (bouton Télécharger).
  - version installée **<** `min_supported_version` → **mise à jour forcée** (bloquante).
  - sinon → rien.

> ⚠️ La détection ne fonctionne que pour les versions **postérieures** à un build
> qui contient déjà ce mécanisme (`UpdateGate`). Le build actuel (1.0.0) est ce
> **socle** : il faut d'abord l'installer ; ensuite les versions 1.1.0+ seront détectées.

---

## 2. Règles d'or (à ne JAMAIS oublier)

1. **Toujours signer chaque APK avec le MÊME keystore.**
   Android refuse d'installer une mise à jour signée avec une autre clé
   (« signatures do not match » → il faudrait désinstaller/réinstaller, ce qui
   perd les données). Avec **EAS Build**, le keystore est stocké sur ton compte
   Expo et réutilisé automatiquement. En **build local**, garde et réutilise
   le même fichier `.keystore`.
2. **`versionCode` (Android) doit STRICTEMENT augmenter** à chaque build
   (`app.json` → `android.versionCode`). Sinon Android n'installe pas le nouvel APK
   par-dessus l'ancien.
3. **Héberge le nouvel APK AVANT de modifier le manifeste.** Si tu bumps
   `latest_version` sans que l'APK soit en ligne, les utilisateurs sont invités
   à télécharger un fichier inexistant.
4. **`expo.version` (app.json) = `latest_version` (manifeste)** pour la version
   que tu publies. Ainsi le nouveau build ne se propose pas la mise à jour à
   lui-même, et les anciens builds la voient.

---

## 3. Procédure pour CHAQUE nouvelle version

Exemple : publier la **1.1.0**.

### Étape 1 — Incrémenter les versions dans `app.json`
```jsonc
"expo": {
  "version": "1.1.0",          // était 1.0.0  (semver : bug = 1.0.x, feature = 1.x.0)
  "android": {
    "versionCode": 2           // était 1  → +1 à chaque build
  }
}
```

### Étape 2 — Construire l'APK
Voir §4. Tu obtiens un fichier `.apk`.

### Étape 3 — Héberger l'APK et récupérer son URL
Recommandé : **GitHub Releases** (voir §5). Tu obtiens une URL directe, ex. :
```
https://github.com/krys237/tontinex360/releases/download/v1.1.0/tontinex360-1.1.0.apk
```

### Étape 4 — Mettre à jour le manifeste `tontinex360_mobile/app-version.json`
```json
{
  "android": {
    "latest_version": "1.1.0",
    "min_supported_version": "",
    "apk_url": "https://github.com/krys237/tontinex360/releases/download/v1.1.0/tontinex360-1.1.0.apk",
    "notes": "• Preuve photo des cotisations\n• Signature de référence + bordereaux\n• Corrections d'affichage"
  }
}
```
- `notes` : le changelog affiché dans la fenêtre (utilise `\n` pour les retours ligne).
- `min_supported_version` : mets une version (ex. `"1.1.0"`) **seulement** si tu veux
  **forcer** tout le monde en dessous à mettre à jour. Sinon laisse `""`.

### Étape 5 — Committer et pousser sur `master`
```bash
git add tontinex360_mobile/app.json tontinex360_mobile/app-version.json
git commit -m "release: v1.1.0"
git push origin master
```

### Étape 6 — Vérifier
- Ouvre l'URL du manifeste dans un navigateur → tu dois voir `latest_version: 1.1.0`.
- Ouvre l'`apk_url` → le téléchargement de l'APK doit démarrer.
- Sur un téléphone avec l'ancienne version installée → au prochain démarrage,
  la fenêtre « Mise à jour disponible » doit apparaître (le cache GitHub raw
  peut prendre ~5 min).

---

## 4. Construire l'APK

### Option A — EAS Build (recommandé, cloud, gère le keystore)
Prérequis (une seule fois) : un compte Expo (gratuit).
```bash
npm install -g eas-cli
eas login
eas build:configure          # si demandé (eas.json existe déjà)
eas build -p android --profile preview
```
- À la fin, EAS donne une **URL de téléchargement de l'APK** (build interne).
- Le keystore est créé/réutilisé automatiquement sur ton compte → signature stable.

### Option B — Build local (nécessite Android SDK + un keystore)
```bash
npx expo prebuild --clean
cd android
./gradlew assembleRelease      # Windows : .\gradlew assembleRelease
```
- APK produit dans `android/app/build/outputs/apk/release/`.
- ⚠️ Configure une fois un **keystore de release** et **réutilise-le** à chaque build
  (le référencer dans `android/gradle.properties` / `android/app/build.gradle`).
  Sans ça, `assembleRelease` utilise une clé de debug qui peut changer → casse les MAJ.

> Rappel : l'app utilise des modules natifs (`expo-image-picker`,
> `react-native-webview`, `react-native-signature-canvas`) → un build natif est
> obligatoire (pas Expo Go). Les deux options ci-dessus les incluent.

---

## 5. Héberger l'APK — GitHub Releases (recommandé)

1. Sur GitHub : repo `krys237/tontinex360` → **Releases** → **Draft a new release**.
2. **Tag** : `v1.1.0`. **Title** : `TontineX360 1.1.0`.
3. Glisse le fichier `.apk` dans la zone des assets.
4. **Publish release**.
5. L'URL de téléchargement direct de l'asset devient l'`apk_url` du manifeste :
   `https://github.com/krys237/tontinex360/releases/download/v1.1.0/<nom-du-fichier>.apk`

Alternatives : un bucket (S3/GCS) ou Firebase Storage (mieux si tu veux du
`Cache-Control: no-cache` pour une propagation instantanée).

---

## 6. Cas particuliers

- **Forcer une mise à jour** (faille, changement bloquant) : mets
  `min_supported_version` égal (ou supérieur) aux versions à bloquer. Toute app
  en dessous verra une fenêtre **non fermable**.
- **Annuler une publication** (mauvais APK) : remets `latest_version` (et
  `apk_url`) sur la version précédente dans le manifeste, commit + push.
- **Désactiver temporairement la vérification** : vide `APP_VERSION_MANIFEST_URL`
  dans `src/config/env.ts` (nécessite un rebuild) — à éviter en prod.
- **iOS** : non couvert (pas de store, sideload impossible sans TestFlight/ad-hoc).
  Le manifeste a une clé `android` uniquement.

---

## 7. Checklist express (à copier à chaque release)

```
[ ] app.json : expo.version bumpé (ex. 1.1.0)
[ ] app.json : android.versionCode +1
[ ] APK construit (même keystore que d'habitude)
[ ] APK hébergé + URL testée (le téléchargement démarre)
[ ] app-version.json : latest_version = nouvelle version
[ ] app-version.json : apk_url = URL du nouvel APK
[ ] app-version.json : notes = changelog
[ ] (optionnel) min_supported_version si MAJ forcée
[ ] git commit + push origin master
[ ] Manifeste vérifié dans le navigateur (latest_version correct)
[ ] Test sur un device avec l'ancienne version → fenêtre de MAJ OK
```

---

## 8. État vérifié au 2026-07-15 (socle 1.0.0)

- `app.json` : `version 1.0.0`, `android.versionCode 1`, package `com.tontinex360.app`,
  permission `CAMERA`, plugin `expo-image-picker` configuré. ✅
- `src/config/env.ts` : `APP_VERSION` lit `app.json`, `APP_VERSION_MANIFEST_URL`
  pointe sur le raw GitHub (`master`). ✅
- `app-version.json` : `latest_version 1.0.0` (= build actuel → pas d'auto-prompt). ✅
- `UpdateGate` monté dans `src/App.tsx`. ✅
- `eas.json` : profil `preview` → APK. ✅

Le socle 1.0.0 est prêt à builder. À partir de lui, toute version publiée via la
procédure §3 sera détectée.
