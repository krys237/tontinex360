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
};
