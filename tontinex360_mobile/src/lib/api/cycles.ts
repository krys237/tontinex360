// Ported from web front (src/lib/api/cycles.ts) — member-facing subset.
import api, { unwrap, Paginated } from './client';
import type { Cycle, Session, AuctionBid } from '../types/cycle';

export const cyclesApi = {
  list: (params?: { status?: string }) =>
    api.get<Cycle[] | Paginated<Cycle>>('/cycles/cycles/', { params }).then((r) => unwrap(r.data)),

  get: (id: string) => api.get<Cycle>(`/cycles/cycles/${id}/`).then((r) => r.data),

  /** The current cycle to subscribe into: prefer active, else draft, else most recent. */
  current: async (): Promise<Cycle | null> => {
    const all = await cyclesApi.list();
    return (
      all.find((c) => c.status === 'active') ??
      all.find((c) => c.status === 'draft') ??
      all[0] ??
      null
    );
  },

  sessions: (params?: { cycle?: string; status?: string }) =>
    api
      .get<Session[] | Paginated<Session>>('/cycles/sessions/', { params })
      .then((r) => unwrap(r.data)),

  getSession: (id: string) => api.get<Session>(`/cycles/sessions/${id}/`).then((r) => r.data),

  // Enchères. Le back ne filtre pas par membership (filterset: pot/status),
  // donc on filtre côté client par le membre courant.
  bids: (params?: { pot?: string; status?: string }) =>
    api
      .get<AuctionBid[] | Paginated<AuctionBid>>('/cycles/bids/', { params })
      .then((r) => unwrap(r.data)),
};
