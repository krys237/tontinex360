import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';

import RootNavigator from './navigation/RootNavigator';
import UpdateGate from './components/UpdateGate';
import { queryClient } from './lib/query-client';
import { hydrateAuth } from './lib/storage/secure-storage';
import { bootstrapSession } from './lib/auth/session';
import { hydrateApp } from './lib/stores/app-store';
import { setUnauthorizedHandler } from './lib/api/client';
import { useAuthStore } from './lib/stores/auth-store';
import { usePushRegistration } from './lib/push/use-push-registration';
import { poppinsFonts, patchTextFonts } from './theme/fonts';
import { colors } from './theme/colors';

// Patch Text/TextInput to default to Poppins (app-wide) before any render.
patchTextFonts();

/** Wait for the persisted store to finish rehydrating before fetching fresh data. */
function waitForStoreHydration(): Promise<void> {
  return new Promise((resolve) => {
    if (useAuthStore.persist.hasHydrated()) return resolve();
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [fontsLoaded] = useFonts(poppinsFonts);

  // Enregistre le token FCM auprès du backend dès qu'une session est active.
  usePushRegistration();

  useEffect(() => {
    // On a final 401 (refresh failed), drop the session -> RootNavigator shows Auth.
    setUnauthorizedHandler(() => {
      void useAuthStore.getState().logout();
    });

    (async () => {
      try {
        await waitForStoreHydration();
        await hydrateApp();
        await hydrateAuth();
        await bootstrapSession();
      } finally {
        setBooting(false);
      }
    })();

    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        {booting || !fontsLoaded ? (
          <View style={styles.splash}>
            <Text style={styles.brand}>TontineX360</Text>
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
          </View>
        ) : (
          <>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            {/* Vérifie une version publiée plus récente et propose la mise à jour. */}
            <UpdateGate />
          </>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  brand: { fontSize: 30, fontWeight: '800', color: colors.primary },
  spinner: { marginTop: 20 },
});
