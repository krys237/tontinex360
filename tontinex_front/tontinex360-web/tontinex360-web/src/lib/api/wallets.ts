import api from './client';
import type {
  Wallet, WalletEntry, WalletSummary, CycleSettlement,
} from '@/lib/types/wallet';

export const walletsApi = {
  // Membre
  myWallet: () =>
    api.get<Wallet>('/wallets/me/').then(r => r.data),
  myEntries: (params?: { session?: string; cycle?: string; source_type?: string }) =>
    api.get<WalletEntry[]>('/wallets/me/entries/', { params }).then(r => r.data),
  mySummary: (cycleId?: string) =>
    api.get<WalletSummary>('/wallets/me/summary/', {
      params: cycleId ? { cycle: cycleId } : undefined,
    }).then(r => r.data),

  // Bureau
  list: () => api.get<Wallet[]>('/wallets/wallets/').then(r => r.data),
  get: (id: string) =>
    api.get<Wallet>(`/wallets/wallets/${id}/`).then(r => r.data),
  entries: (walletId: string) =>
    api.get<WalletEntry[]>(`/wallets/wallets/${walletId}/entries/`).then(r => r.data),
  recompute: (walletId: string) =>
    api.post<Wallet>(`/wallets/wallets/${walletId}/recompute/`).then(r => r.data),

  manualAdjustment: (data: {
    membership_id: string;
    direction: 'credit' | 'debit';
    amount: number | string;
    description: string;
    session_id?: string | null;
    cycle_id?: string | null;
  }) => api.post<WalletEntry>('/wallets/manual-adjustment/', data).then(r => r.data),

  cycleSettlement: (cycleId: string) =>
    api.get<CycleSettlement>('/wallets/cycle-settlement/', {
      params: { cycle: cycleId },
    }).then(r => r.data),
};
