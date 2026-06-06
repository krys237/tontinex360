// App-level UI state that isn't auth: whether the intro/onboarding has been seen.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@tontinex360/onboarding_seen';

interface AppState {
  onboardingSeen: boolean;
  setOnboardingSeen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  onboardingSeen: false,
  setOnboardingSeen: (v) => {
    set({ onboardingSeen: v });
    AsyncStorage.setItem(ONBOARDING_KEY, v ? '1' : '0').catch(() => {});
  },
}));

/** Read the persisted onboarding flag into the store (call at startup). */
export async function hydrateApp(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_KEY);
    useAppStore.setState({ onboardingSeen: v === '1' });
  } catch {
    // default: not seen
  }
}
