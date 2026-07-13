/**
 * Axios HTTP client for TontineX360 mobile.
 *
 * Mirrors the web front's client.ts conventions:
 *   - Authorization: Bearer <access_token>
 *   - X-Tenant: <active_association_slug>   (multi-tenant header — the REAL header,
 *     the .pptx's "X-Association-Slug" is obsolete)
 *   - On 401 -> POST /auth/token/refresh/ { refresh } -> { access }, retry once.
 *   - DRF pagination { count, next, previous, results } -> unwrap().
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_URL } from '../../config/env';
import {
  tokenCache,
  setAccessToken,
  clearAuth,
} from '../storage/secure-storage';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// --- Request interceptor: attach auth + tenant headers ---
// NOTE pagination : depuis la MAJ backend (common.pagination.StandardPagination),
// TOUTES les listes DRF sont paginées (20/page par défaut, max 200). Sans
// page_size, les écrans mobiles ne recevraient que 20 éléments et les totaux/KPIs
// calculés côté client seraient faux. On force donc page_size=200 (le plafond
// backend) sur les GET, sauf si l'appelant l'a déjà précisé. `unwrap()` continue
// d'extraire `results`. Limite connue : > 200 éléments nécessiteraient une
// vraie pagination/infinite-scroll (à traiter au cas par cas).
const DEFAULT_PAGE_SIZE = 200;
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenCache.getAccess();
  const slug = tokenCache.getSlug();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (slug) config.headers.set?.('X-Tenant', slug);
  if ((config.method ?? 'get').toLowerCase() === 'get') {
    config.params = { page_size: DEFAULT_PAGE_SIZE, ...(config.params ?? {}) };
  }
  return config;
});

// --- 401 handling: refresh once, else sign out ---
// The app registers a handler (e.g. to reset navigation to the login screen).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refresh = tokenCache.getRefresh();
      if (refresh) {
        try {
          // Use a bare axios call to avoid the interceptor recursion.
          const { data } = await axios.post<{ access: string }>(
            `${API_URL}/auth/token/refresh/`,
            { refresh },
          );
          setAccessToken(data.access);
          original.headers.set?.('Authorization', `Bearer ${data.access}`);
          return api(original);
        } catch (refreshError) {
          await clearAuth();
          onUnauthorized?.();
          return Promise.reject(refreshError);
        }
      }
      await clearAuth();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// --- DRF pagination helpers ---
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function isPaginated<T>(data: unknown): data is Paginated<T> {
  return (
    !!data &&
    typeof data === 'object' &&
    'results' in (data as object) &&
    Array.isArray((data as Paginated<T>).results)
  );
}

/** Tolerates both raw arrays and DRF paginated envelopes. */
export function unwrap<T>(data: T[] | Paginated<T> | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (isPaginated<T>(data)) return data.results;
  return [];
}

export default api;
