/**
 * Secure storage for auth tokens + active association slug.
 *
 * Tokens live in the OS secure store via expo-secure-store (Keychain/Keystore).
 * The active association slug is not secret -> AsyncStorage.
 *
 * An in-memory cache (`memo`) lets the axios interceptors read the current
 * access token / tenant slug SYNCHRONOUSLY. Call `hydrateAuth()` once at startup.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'tx360_access_token';
const REFRESH_KEY = 'tx360_refresh_token';
const SLUG_KEY = '@tontinex360/active_association';

export interface Tokens {
  access: string;
  refresh: string;
}

const memo: { access: string | null; refresh: string | null; slug: string | null } = {
  access: null,
  refresh: null,
  slug: null,
};

/** Synchronous accessors used by the axios interceptors. */
export const tokenCache = {
  getAccess: () => memo.access,
  getRefresh: () => memo.refresh,
  getSlug: () => memo.slug,
  hasSession: () => !!memo.access,
};

/** Load tokens + active slug from disk into the in-memory cache. */
export async function hydrateAuth(): Promise<void> {
  try {
    memo.access = await SecureStore.getItemAsync(ACCESS_KEY);
    memo.refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    memo.access = null;
    memo.refresh = null;
  }
  try {
    memo.slug = await AsyncStorage.getItem(SLUG_KEY);
  } catch {
    memo.slug = null;
  }
}

export async function saveTokens(t: Tokens): Promise<void> {
  memo.access = t.access;
  memo.refresh = t.refresh;
  await SecureStore.setItemAsync(ACCESS_KEY, t.access);
  await SecureStore.setItemAsync(REFRESH_KEY, t.refresh);
}

/** Update only the access token (after a 401 refresh). */
export function setAccessToken(access: string): void {
  memo.access = access;
  // best-effort persist; do not await inside an interceptor
  SecureStore.setItemAsync(ACCESS_KEY, access).catch(() => {});
}

export async function setActiveSlug(slug: string | null): Promise<void> {
  memo.slug = slug;
  if (slug) await AsyncStorage.setItem(SLUG_KEY, slug);
  else await AsyncStorage.removeItem(SLUG_KEY);
}

export async function clearAuth(): Promise<void> {
  memo.access = null;
  memo.refresh = null;
  memo.slug = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
  await AsyncStorage.removeItem(SLUG_KEY).catch(() => {});
}
