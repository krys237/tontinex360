import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Association } from '@/lib/types/auth';
import type { Membership } from '@/lib/types/member';

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
  logout: () => void;
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
        if (typeof window !== 'undefined') {
          if (a?.slug) localStorage.setItem('active_association', a.slug);
          else localStorage.removeItem('active_association');
        }
        set({ activeAssociation: a, currentMembership: null });
      },
      setCurrentMembership: (m) => set({ currentMembership: m }),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('active_association');
        }
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
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
