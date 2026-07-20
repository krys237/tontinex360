/**
 * Push notifications (FCM).
 *
 * Android uniquement pour l'instant : google-services.json ne contient qu'un
 * client Android et il n'y a pas de GoogleService-Info.plist ni de capability
 * APNs. Les fonctions ci-dessous sont donc des no-op sûrs sur iOS.
 *
 * Le token est envoyé au backend via POST /auth/register-fcm-token/.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import {
  deleteToken,
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { authApi } from '../api/auth';

export type DeviceType = 'android' | 'ios' | 'web';

export function currentDeviceType(): DeviceType {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * POST_NOTIFICATIONS n'existe qu'à partir d'Android 13 (API 33) ; avant, la
 * permission est accordée d'office à l'installation.
 */
async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Demande la permission, récupère le token FCM et l'enregistre côté serveur.
 * Retourne le token, ou null si la permission est refusée / plateforme non gérée.
 */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  const granted = await ensureAndroidPermission();
  if (!granted) return null;

  const token = await getToken(getMessaging());
  if (!token) return null;

  await sendPushTokenToBackend(token);
  return token;
}

/** Send an already-obtained token to the backend. */
export async function sendPushTokenToBackend(token: string): Promise<void> {
  await authApi.registerFcmToken({ token, device_type: currentDeviceType() });
}

/**
 * Supprime le token FCM local au logout : l'appareil cesse de recevoir les
 * notifications du compte qui se déconnecte, et le login suivant repart d'un
 * token neuf.
 *
 * ⚠️ Ne supprime rien côté serveur — l'API n'expose pas de désenregistrement.
 * Le token reste en base, associé à l'ancien user, jusqu'à ce que FCM le
 * rejette (NotRegistered). Voir la note dans registerFcmToken côté backend.
 */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await deleteToken(getMessaging());
}

/**
 * FCM peut faire tourner le token (réinstallation, restauration, purge des
 * données). Sans ce listener le serveur garderait un token mort et les envois
 * échoueraient en silence.
 */
export function subscribeToTokenRefresh(): () => void {
  if (Platform.OS !== 'android') return () => {};

  return onTokenRefresh(getMessaging(), (token) => {
    void sendPushTokenToBackend(token).catch(() => {
      // Le prochain registerPushToken() au login rattrapera l'échec.
    });
  });
}
