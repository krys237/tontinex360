import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tontine-project.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Helper pour récupérer le slug actif (lu côté client uniquement)
function getActiveTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_association');
}

// Intercepteur requête : Bearer token + X-Tenant
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    const slug = getActiveTenantSlug();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (slug) config.headers['X-Tenant'] = slug;
  }
  return config;
});

/**
 * Détecte une réponse paginée DRF standard et la dépile en tableau brut.
 * Heuristique : objet avec `count` (number), `results` (array), et présence de
 * `next` ou `previous` (peuvent être null mais le clé existe).
 */
function isPaginatedDRF(data: any): boolean {
  return (
    !!data
    && typeof data === 'object'
    && !Array.isArray(data)
    && typeof data.count === 'number'
    && Array.isArray(data.results)
    && ('next' in data || 'previous' in data)
  );
}

// Intercepteur réponse : déballe automatiquement les paginations DRF
// + refresh token sur 401
api.interceptors.response.use(
  (res) => {
    if (isPaginatedDRF(res.data)) {
      // Conserve les métadonnées sur la propriété `_pagination` du tableau
      const arr = res.data.results as any[];
      Object.defineProperty(arr, '_pagination', {
        value: { count: res.data.count, next: res.data.next, previous: res.data.previous },
        enumerable: false,
      });
      res.data = arr;
    }
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post<{ access: string }>(
          `${API_URL}/auth/token/refresh/`,
          { refresh }
        );
        localStorage.setItem('access_token', data.access);
        if (original.headers) {
          original.headers.Authorization = `Bearer ${data.access}`;
        }
        return api(original);
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('active_association');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_URL };

/**
 * Réponse paginée standard DRF (PageNumberPagination).
 */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Extrait `results` d'une réponse paginée DRF, tout en restant tolérant si
 * jamais l'endpoint n'est pas paginé (renvoie déjà un tableau brut).
 */
export function unwrap<T>(data: T[] | Paginated<T> | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && Array.isArray((data as Paginated<T>).results)) {
    return (data as Paginated<T>).results;
  }
  return [];
}
