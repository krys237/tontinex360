import api from './client';
import type { Cycle, CycleTontineConfig } from '@/lib/types/cycle';

export const cyclesApi = {
  // Cycles
  list: (params?: { status?: string }) =>
    api.get<Cycle[]>('/cycles/cycles/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Cycle>(`/cycles/cycles/${id}/`).then(r => r.data),
  create: (data: Partial<Cycle>) =>
    api.post<Cycle>('/cycles/cycles/', data).then(r => r.data),
  update: (id: string, data: Partial<Cycle>) =>
    api.patch<Cycle>(`/cycles/cycles/${id}/`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/cycles/cycles/${id}/`).then(r => r.data),

  // Configs des tontines pour un cycle
  configs: (cycleId?: string) =>
    api.get<CycleTontineConfig[]>('/cycles/configs/', {
      params: cycleId ? { cycle: cycleId } : undefined,
    }).then(r => r.data),
  createConfig: (data: Partial<CycleTontineConfig>) =>
    api.post<CycleTontineConfig>('/cycles/configs/', data).then(r => r.data),
  updateConfig: (id: string, data: Partial<CycleTontineConfig>) =>
    api.patch<CycleTontineConfig>(`/cycles/configs/${id}/`, data).then(r => r.data),

  // Récurrence
  previewDates: (cycleId: string, limit = 12) =>
    api.get<{ dates: string[]; count: number }>(
      `/cycles/cycles/${cycleId}/preview-dates/`,
      { params: { limit } },
    ).then(r => r.data),
  generateSessions: (cycleId: string) =>
    api.post<{ created: number; skipped: number; reason: string }>(
      `/cycles/cycles/${cycleId}/generate-sessions/`,
    ).then(r => r.data),
};
