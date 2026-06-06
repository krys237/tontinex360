// Procurations (proxies) — un membre mandate un autre membre pour le représenter
// à une séance. Le mandant (grantor) est déduit côté serveur depuis l'utilisateur.
import api, { unwrap, Paginated } from './client';

export type ProxyStatus = 'pending' | 'approved' | 'rejected' | 'used' | 'cancelled';

export interface Proxy {
  id: string;
  grantor?: string;
  grantor_name?: string;
  proxy: string; // membership mandatée
  proxy_name?: string;
  session: string;
  session_number?: number | null;
  session_date?: string | null;
  tontine?: string | null; // optionnel : limiter à une tontine (sinon toutes)
  tontine_name?: string | null;
  reason?: string;
  proxy_cni_number?: string;
  status?: ProxyStatus;
  status_display?: string;
  created_at?: string;
}

export const proxiesApi = {
  list: (params?: { session?: string; status?: string }) =>
    api.get<Proxy[] | Paginated<Proxy>>('/proxies/', { params }).then((r) => unwrap(r.data)),

  get: (id: string) => api.get<Proxy>(`/proxies/${id}/`).then((r) => r.data),

  create: (data: Partial<Proxy>) => api.post<Proxy>('/proxies/', data).then((r) => r.data),
};
