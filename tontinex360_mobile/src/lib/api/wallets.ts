// Ported from web front (src/lib/api/wallets.ts). Member-facing + bureau read.
import api, { unwrap, Paginated } from './client';
import type { Wallet, WalletEntry, WalletSummary } from '../types/wallet';

export const walletsApi = {
  myWallet: () => api.get<Wallet>('/wallets/me/').then((r) => r.data),

  myEntries: (params?: { session?: string; cycle?: string; source_type?: string }) =>
    api
      .get<WalletEntry[] | Paginated<WalletEntry>>('/wallets/me/entries/', { params })
      .then((r) => unwrap(r.data)),

  mySummary: (cycleId?: string) =>
    api
      .get<WalletSummary>('/wallets/me/summary/', {
        params: cycleId ? { cycle: cycleId } : undefined,
      })
      .then((r) => r.data),

  // ---------- Bureau : tous les portefeuilles ----------
  list: () =>
    api.get<Wallet[] | Paginated<Wallet>>('/wallets/wallets/').then((r) => unwrap(r.data)),
  get: (id: string) => api.get<Wallet>(`/wallets/wallets/${id}/`).then((r) => r.data),
  entries: (id: string) =>
    api
      .get<WalletEntry[] | Paginated<WalletEntry>>(`/wallets/wallets/${id}/entries/`)
      .then((r) => unwrap(r.data)),
  recompute: (id: string) =>
    api.post<Wallet>(`/wallets/wallets/${id}/recompute/`).then((r) => r.data),

  /** Ajustement manuel (→ soumis à approbation bureau côté serveur). */
  manualAdjustment: (data: {
    membership_id: string;
    direction: 'credit' | 'debit';
    amount: number;
    description: string;
    session_id?: string;
    cycle_id?: string;
  }) => api.post('/wallets/manual-adjustment/', data).then((r) => r.data),

  cycleSettlement: (cycleId?: string) =>
    api
      .get('/wallets/cycle-settlement/', { params: cycleId ? { cycle: cycleId } : undefined })
      .then((r) => r.data),
};
