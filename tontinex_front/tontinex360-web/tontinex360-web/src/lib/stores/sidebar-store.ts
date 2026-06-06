import { create } from 'zustand';

interface SidebarState {
  isMobileOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Contrôle l'ouverture de la sidebar sur mobile (drawer overlay).
 * Sur desktop (>= lg), la sidebar est toujours visible et ce state est ignoré.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  isMobileOpen: false,
  open: () => set({ isMobileOpen: true }),
  close: () => set({ isMobileOpen: false }),
  toggle: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
}));
