// App-level UI state that isn't auth: whether the intro/onboarding has been seen,
// and which associations have dismissed the president welcome tutorial.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@tontinex360/onboarding_seen';
const PRESIDENT_TUTO_KEY = '@tontinex360/president_tuto_dismissed';

interface AppState {
  onboardingSeen: boolean;
  setOnboardingSeen: (v: boolean) => void;
  /** Slugs des associations pour lesquelles le tuto président a été fermé. */
  presidentTutoDismissed: string[];
  dismissPresidentTuto: (slug: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  onboardingSeen: false,
  setOnboardingSeen: (v) => {
    set({ onboardingSeen: v });
    AsyncStorage.setItem(ONBOARDING_KEY, v ? '1' : '0').catch(() => {});
  },
  presidentTutoDismissed: [],
  dismissPresidentTuto: (slug) => {
    const next = Array.from(new Set([...get().presidentTutoDismissed, slug]));
    set({ presidentTutoDismissed: next });
    AsyncStorage.setItem(PRESIDENT_TUTO_KEY, JSON.stringify(next)).catch(() => {});
  },
}));

/** Read the persisted app flags into the store (call at startup). */
export async function hydrateApp(): Promise<void> {
  try {
    const [seen, tuto] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(PRESIDENT_TUTO_KEY),
    ]);
    useAppStore.setState({
      onboardingSeen: seen === '1',
      presidentTutoDismissed: tuto ? JSON.parse(tuto) : [],
    });
  } catch {
    // defaults: not seen, none dismissed
  }
}
