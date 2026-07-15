import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuthStore } from '../lib/stores/auth-store';
import { useAppStore } from '../lib/stores/app-store';
import IntroStack from './IntroStack';
import AuthStack from './AuthStack';
import WorkspaceStack from './WorkspaceStack';
import AppStack from './AppStack';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Top-level routing:
 *   not logged in + intro not seen -> Intro (splash/onboarding)
 *   not logged in                  -> Auth (login / register / otp / invite)
 *   logged in, no active asso       -> Workspace (create / join)
 *   logged in + active asso         -> App (drawer)
 */
export default function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const activeAssociation = useAuthStore((s) => s.activeAssociation);
  const onboardingSeen = useAppStore((s) => s.onboardingSeen);

  let screen: React.ReactNode;
  if (user) {
    screen = activeAssociation ? (
      <RootStack.Screen name="App" component={AppStack} />
    ) : (
      <RootStack.Screen name="Workspace" component={WorkspaceStack} />
    );
  } else {
    screen = onboardingSeen ? (
      <RootStack.Screen name="Auth" component={AuthStack} />
    ) : (
      <RootStack.Screen name="Intro" component={IntroStack} />
    );
  }

  // Clefer sur l'asso active force le remontage complet d'AppStack au changement
  // de tenant : le back-stack est vidé (plus de route SessionDetail{id}/Cotiser{…}
  // d'un tenant dans l'autre) et les permissions repartent de zéro.
  return (
    <RootStack.Navigator key={activeAssociation?.slug ?? 'none'} screenOptions={{ headerShown: false }}>
      {screen}
    </RootStack.Navigator>
  );
}
