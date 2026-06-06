// Ported from web front (src/lib/api/tontines.ts).
import api, { unwrap, Paginated } from './client';
import type { TontineType, MemberSubscription } from '../types/tontine';

export const tontinesApi = {
  types: (params?: { is_active?: boolean }) =>
    api
      .get<TontineType[] | Paginated<TontineType>>('/tontines/types/', { params })
      .then((r) => unwrap(r.data)),

  getType: (id: string) =>
    api.get<TontineType>(`/tontines/types/${id}/`).then((r) => r.data),

  subscriptions: (params?: { cycle?: string; tontine_type?: string }) =>
    api
      .get<MemberSubscription[] | Paginated<MemberSubscription>>('/tontines/subscriptions/', { params })
      .then((r) => unwrap(r.data)),

  createSubscription: (data: Partial<MemberSubscription>) =>
    api.post<MemberSubscription>('/tontines/subscriptions/', data).then((r) => r.data),

  updateSubscription: (id: string, data: Partial<MemberSubscription>) =>
    api.patch<MemberSubscription>(`/tontines/subscriptions/${id}/`, data).then((r) => r.data),

  removeSubscription: (id: string) =>
    api.delete(`/tontines/subscriptions/${id}/`).then((r) => r.data),
};
