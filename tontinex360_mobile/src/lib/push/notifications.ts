/**
 * Affichage local des notifications push (notifee).
 *
 * Firebase Messaging livre les messages mais n'affiche RIEN quand l'app est au
 * premier plan (Android n'affiche automatiquement que lorsqu'elle est en
 * arrière-plan / fermée). notifee comble ce trou : on écoute `onMessage` et on
 * affiche nous-mêmes une notification système.
 *
 * Android uniquement pour l'instant (cf. fcm.ts — pas de config iOS/APNs).
 */
import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/** Doit rester constant : le backend ne fixe pas de channel, on route tout ici. */
export const DEFAULT_CHANNEL_ID = 'default';

let channelReady: Promise<void> | null = null;

/**
 * Android 8+ exige qu'une notification appartienne à un channel, sinon elle
 * n'apparaît pas. Idempotent (createChannel écrase sans dupliquer).
 */
export function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = notifee
      .createChannel({
        id: DEFAULT_CHANNEL_ID,
        name: 'Notifications',
        importance: AndroidImportance.HIGH,
      })
      .then(() => undefined);
  }
  return channelReady;
}

/**
 * Affiche un message FCM sous forme de notification système.
 * `data` est conservé pour le routing au tap (deep-link ultérieur).
 */
export async function displayRemoteMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const title = message.notification?.title ?? (message.data?.title as string) ?? 'TontineX360';
  const body = message.notification?.body ?? (message.data?.body as string) ?? '';

  await ensureNotificationChannel();
  await notifee.displayNotification({
    title,
    body,
    data: message.data,
    android: {
      channelId: DEFAULT_CHANNEL_ID,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
    },
  });
}

/**
 * Écoute les messages reçus app ouverte et les affiche. Retourne la fonction de
 * désinscription. En arrière-plan / app fermée, un message avec bloc
 * `notification` est affiché automatiquement par le système : ne pas le
 * ré-afficher ici (ce handler ne tourne qu'au premier plan).
 */
export function subscribeForegroundMessages(): () => void {
  if (Platform.OS !== 'android') return () => {};

  return onMessage(getMessaging(), (message) => {
    void displayRemoteMessage(message).catch(() => {});
  });
}
