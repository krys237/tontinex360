# tontinex360 — App mobile (Expo + dev-client)

App mobile de TontineX360 (membre + bureau), parité avec le front web Next.js.
Plan global : [`../MOBILE_PLAN.md`](../MOBILE_PLAN.md).

- **Stack** : **Expo SDK 55** (RN 0.83.6, React 19.2), TypeScript. Workflow **prebuild + dev-client** (CNG : `android/` & `ios/` régénérés par `expo prebuild`, config dans `app.json`).
- **Bundle id** : `com.tontinex360.app` · **slug** : `tontinex360` · **scheme** : `tontinex360://`
- **API** : `https://api.tontinex360.com/api` · **WS** : `wss://api.tontinex360.com/ws`
- Modules Expo : `expo-linear-gradient`, `expo-secure-store` (tokens), `expo-status-bar`, `expo-dev-client`. Icônes : `lucide-react-native` (via `react-native-svg`). Nav : `@react-navigation` native-stack + bottom-tabs.

## Build & lancement (workflow WSL → Windows)

Sur **WSL** (Node 20+, JDK 17, Android SDK), depuis le projet copié en local Linux :

```bash
npm install
npx expo prebuild --clean        # (re)génère android/ (et ios/)
npx expo run:android             # build debug + install sur le device branché
# pour un APK release :
# cd android && ./gradlew assembleRelease
```

Puis depuis **Windows**, pour itérer sans rebuild :

```bash
npx expo start --dev-client      # Metro ; ouvrir l'app dev-client sur le device
```

> ⚠️ Ne pas utiliser `react-native run-android` ni committer `android/`/`ios/` : ils sont **générés** par `expo prebuild` (voir `.gitignore`). Toute conf native (permissions, icône, plugins) se met dans `app.json`.

## Architecture (`src/`)

```
config/env.ts                 URLs API/WS
lib/storage/secure-storage    tokens (expo-secure-store) + slug tenant (AsyncStorage) + cache mémoire
lib/api/client.ts             axios : Bearer + X-Tenant, refresh 401, dépagination DRF
lib/api/*.ts                  clients API
lib/auth/session.ts           login / bootstrap / switchAssociation / logout
lib/stores/                   auth-store + app-store (onboarding) — zustand
lib/permissions.ts            can/canAny/isBureau/isPresident (porté du web)
components/ui/                kit UI (Card, TextField, PhoneField, OtpInput, Buttons, …)
navigation/                   RootNavigator → Intro / Auth / Workspace / AppTabs
screens/                      intro/ auth/ workspace/ app/
theme/                        couleurs, typo, spacing (alignés Figma)
```

## Statut

- **Phase 0 (socle)** + **Phase 1 (Auth & Onboarding)** : ✅ (typecheck + `expo export` OK).
- **Phase 2 (Dashboard + Membres)** : à venir.

### À confirmer / câblage restant
- Accept-invite : soumission finale (token du lien + payload `register-and-accept`) à valider via `/swagger/`.
- Rejoindre : POST `membership-requests` dans le tenant cible à confirmer.
- Boutons Google/Apple : backend sans OAuth → « bientôt disponible ».
- Police **Poppins** non ajoutée (police système) — possible via `expo-font` + plugin.
- **Push** : à câbler avec `expo-notifications` (Phase 6) — remplace le stub `lib/push/fcm.ts`.
