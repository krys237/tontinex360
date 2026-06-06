/**
 * Push notifications (FCM) — SCAFFOLD.
 *
 * The actual delivery uses Firebase Cloud Messaging. Native setup is pending:
 *   1. npm i @react-native-firebase/app @react-native-firebase/messaging
 *   2. Android: add google-services.json + the google-services gradle plugin
 *   3. iOS: add GoogleService-Info.plist + APNs capability
 * Until then this module is a safe no-op so the rest of the app builds & runs.
 *
 * Once wired, call registerPushToken() after login to send the device token to
 * the backend via POST /auth/register-fcm-token/.
 */
import { Platform } from 'react-native';
import { authApi } from '../api/auth';

export type DeviceType = 'android' | 'ios' | 'web';

export function currentDeviceType(): DeviceType {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Request permission + obtain the FCM token + register it server-side.
 * Returns the token, or null if push isn't available yet.
 */
export async function registerPushToken(): Promise<string | null> {
  // TODO(Phase 6): replace with @react-native-firebase/messaging
  //   const messaging = (await import('@react-native-firebase/messaging')).default;
  //   await messaging().requestPermission();
  //   const token = await messaging().getToken();
  //   await authApi.registerFcmToken({ token, device_type: currentDeviceType() });
  //   return token;
  return null;
}

/** Send an already-obtained token to the backend. */
export async function sendPushTokenToBackend(token: string): Promise<void> {
  await authApi.registerFcmToken({ token, device_type: currentDeviceType() });
}
