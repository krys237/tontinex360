// Ported from web front (src/lib/api/cycles.ts) — membre + bureau.
import api, { unwrap, Paginated } from './client';
import type { Cycle, CycleTontineConfig, Session, AuctionBid } from '../types/cycle';

export interface CycleSessionsStats {
  total_sessions?: number;
  completed_sessions?: number;
  scheduled_sessions?: number;
  in_progress_sessions?: number;
  cancelled_sessions?: number;
  progress_percent?: number;
  total_distributed?: number | string;
  average_attendance?: number;
  total_sanctions?: number;
  [key: string]: any;
}

export const cyclesApi = {
  list: (params?: { status?: string }) =>
    api.get<Cycle[] | Paginated<Cycle>>('/cycles/cycles/', { params }).then((r) => unwrap(r.data)),

  get: (id: string) => api.get<Cycle>(`/cycles/cycles/${id}/`).then((r) => r.data),

  // ---------- Bureau : gestion des cycles ----------
  create: (data: Partial<Cycle>) =>
    api.post<Cycle>('/cycles/cycles/', data).then((r) => r.data),
  update: (id: string, data: Partial<Cycle>) =>
    api.patch<Cycle>(`/cycles/cycles/${id}/`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/cycles/cycles/${id}/`).then((r) => r.data),

  configs: (cycleId?: string) =>
    api
      .get<CycleTontineConfig[] | Paginated<CycleTontineConfig>>('/cycles/configs/', {
        params: cycleId ? { cycle: cycleId } : undefined,
      })
      .then((r) => unwrap(r.data)),

  previewDates: (cycleId: string, limit = 12) =>
    api
      .get<{ dates: string[]; count: number }>(`/cycles/cycles/${cycleId}/preview-dates/`, {
        params: { limit },
      })
      .then((r) => r.data),
  generateSessions: (cycleId: string) =>
    api
      .post<{ created: number; skipped: number; reason: string }>(
        `/cycles/cycles/${cycleId}/generate-sessions/`,
      )
      .then((r) => r.data),
  sessionsStats: (cycleId: string) =>
    api.get<CycleSessionsStats>(`/cycles/cycles/${cycleId}/sessions-stats/`).then((r) => r.data),

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
