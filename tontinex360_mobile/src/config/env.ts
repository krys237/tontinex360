/**
 * Environment configuration for TontineX360 mobile.
 *
 * Production endpoints (confirmed by the team, 2026-06):
 *   - REST API : https://api.tontinex360.com/api
 *   - WebSocket: wss://api.tontinex360.com/ws
 *
 * NB: the web front uses NEXT_PUBLIC_API_URL; here we hardcode prod and allow
 * an override at build time later (e.g. via react-native-config) if needed.
 */
export const API_URL = 'https://api.tontinex360.com/api';
export const WS_URL = 'wss://api.tontinex360.com/ws';

// Version installée de l'app — lue depuis app.json (source unique de vérité).
// Comparée à la version publiée (manifeste JSON hébergé) pour proposer une mise
// à jour hors store. Bumper `expo.version` dans app.json à chaque build.
import appConfig from '../../app.json';
export const APP_VERSION: string = appConfig.expo.version;

// URL d'un manifeste JSON statique décrivant la dernière version publiée.
// Gère les mises à jour SANS backend : édite ce fichier (GitHub raw, gist,
// bucket…) pour publier une nouvelle version. Format : voir app-version.json
// à la racine du projet. Laisser vide ('') désactive la vérification.
export const APP_VERSION_MANIFEST_URL: string =
  'https://raw.githubusercontent.com/krys237/tontinex360/master/tontinex360_mobile/app-version.json';
