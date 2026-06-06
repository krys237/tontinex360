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
