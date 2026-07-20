import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { registerPushToken, subscribeToTokenRefresh } from './fcm';
import { ensureNotificationChannel, subscribeForegroundMessages } from './notifications';

/**
 * Met en place les notifications push :
 *  - toujours : channel Android + affichage des messages reçus app ouverte ;
 *  - à la connexion : enregistrement du token FCM + suivi de ses rotations.
 *
 * Sans l'affichage au premier plan, une notification reçue pendant qu'on
 * utilise l'app est silencieusement ignorée (Android n'auto-affiche qu'en
 * arrière-plan).
 */
export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.user?.id);

  // Affichage au premier plan — indépendant de la session.
  useEffect(() => {
    void ensureNotificationChannel();
    return subscribeForegroundMessages();
  }, []);

  // Enregistrement du token — réexécuté si le compte change sur l'appareil.
  useEffect(() => {
    if (!userId) return;

    void registerPushToken().catch(() => {
      // Échec réseau ou permission refusée : pas de push, mais l'app continue.
      // Un prochain lancement retentera.
    });

    return subscribeToTokenRefresh();
  }, [userId]);
}
