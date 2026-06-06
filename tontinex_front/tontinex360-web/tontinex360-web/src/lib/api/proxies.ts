import api from './client';
import type { Proxy } from '@/lib/types/proxy';

export const proxiesApi = {
  list: (params?: {
    status?: string; session?: string;
    principal?: string; proxy?: string; tontine_type?: string;
  }) => api.get<Proxy[]>('/proxies/', { params }).then(r => r.data),

  get: (id: string) =>
    api.get<Proxy>(`/proxies/${id}/`).then(r => r.data),

  create: (data: Partial<Proxy> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.post<Proxy>(
      '/proxies/',
      data,
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },

  update: (id: string, data: Partial<Proxy>) =>
    api.patch<Proxy>(`/proxies/${id}/`, data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/proxies/${id}/`).then(r => r.data),

  approve: (id: string, review_note = '') =>
    api.post<Proxy>(`/proxies/${id}/approve/`, { review_note }).then(r => r.data),

  reject: (id: string, review_note = '') =>
    api.post<Proxy>(`/proxies/${id}/reject/`, { review_note }).then(r => r.data),

  cancel: (id: string) =>
    api.post<Proxy>(`/proxies/${id}/cancel/`).then(r => r.data),

  active: (sessionId: string, tontineTypeId?: string) =>
    api.get<Proxy[]>('/proxies/active/', {
      params: tontineTypeId
        ? { session: sessionId, tontine_type: tontineTypeId }
        : { session: sessionId },
    }).then(r => r.data),
};
