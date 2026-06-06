// Auth store (zustand) — mirrors the web store, adapted for React Native.
// Non-sensitive session state is persisted via AsyncStorage.
// Tokens are NOT kept here — they live in the secure store (see secure-storage.ts).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Association } from '../types/auth';
import type { Membership } from '../types/member';
import { setActiveSlug, clearAuth } from '../storage/secure-storage';

interface AuthState {
  user: User | null;
  associations: Association[];
  activeAssociation: Association | null;
  currentMembership: Membership | null;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setAssociations: (a: Association[]) => void;
  setActiveAssociation: (a: Association | null) => void;
  setCurrentMembership: (m: Membership | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      associations: [],
      activeAssociation: null,
      currentMembership: null,
      isHydrated: false,

      setUser: (user) => set({ user }),
      setAssociations: (associations) => set({ associations }),

      setActiveAssociation: (a) => {
        // Keep the secure-storage tenant slug in sync for the axios interceptor.
        void setActiveSlug(a?.slug ?? null);
        // Switching association invalidates the resolved membership.
        set({ activeAssociation: a, currentMembership: null });
      },

      setCurrentMembership: (m) => set({ currentMembership: m }),

      logout: async () => {
        await clearAuth();
        set({
          user: null,
          associations: [],
          activeAssociation: null,
          currentMembership: null,
        });
      },
    }),
    {
      name: 'tx360-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        associations: state.associations,
        activeAssociation: state.activeAssociation,
        currentMembership: state.currentMembership,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
