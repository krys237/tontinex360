import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './src/App';
import { displayRemoteMessage } from './src/lib/push/notifications';

// Handler d'arrière-plan / app fermée. Doit être enregistré au niveau module,
// hors de l'arbre React. Les messages porteurs d'un bloc `notification` sont
// déjà affichés par le système en arrière-plan : on n'affiche ici que les
// messages data-only, pour éviter les doublons.
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  if (!remoteMessage?.notification) {
    await displayRemoteMessage(remoteMessage);
  }
});

// registerRootComponent ensures the env is set up for both Expo Go and native builds.
registerRootComponent(App);
