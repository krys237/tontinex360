/**
 * Session orchestration: login, startup bootstrap, association switching, logout.
 * These are plain async functions operating on the auth store + secure storage,
 * so they can be called from screens or from App startup alike.
 */
import { authApi } from '../api/auth';
import { membersApi } from '../api/members';
import { useAuthStore } from '../stores/auth-store';
import { saveTokens, tokenCache } from '../storage/secure-storage';
import type { Association } from '../types/auth';

export type SessionStatus = 'authenticated' | 'unauthenticated';

/** Find the logged-in user's membership in the active association and load its roles. */
async function resolveCurrentMembership(): Promise<void> {
  const { user, setCurrentMembership } = useAuthStore.getState();
  if (!user) return;
  try {
    const list = await membersApi.list();
    const mine = list.find(
      (li) => li.user_telephone === user.telephone || li.user_name?.includes(user.telephone),
    );
    if (mine) {
      const full = await membersApi.get(mine.id);
      setCurrentMembership(full);
    } else {
      setCurrentMembership(null);
    }
  } catch {
    // membership resolution is best-effort; permissions default to lambda if it fails
    setCurrentMembership(null);
  }
}

/** Re-fetch associations + membership (e.g. after creating an association). */
export async function refreshWorkspace(): Promise<void> {
  await loadAssociationsAndMembership();
}

/** Load the user's associations, pick the active one, then resolve membership. */
async function loadAssociationsAndMembership(): Promise<void> {
  const store = useAuthStore.getState();
  const { associations, active_slug } = await authApi.myAssociations();
  store.setAssociations(associations);

  const active =
    associations.find((a) => a.slug === active_slug) ?? associations[0] ?? null;
  store.setActiveAssociation(active); // also syncs the X-Tenant slug

  if (active) await resolveCurrentMembership();
}

/** Phone + password login. */
export async function loginWithPassword(
  telephone: string,
  password: string,
): Promise<void> {
  const res = await authApi.login({ telephone, password });
  await saveTokens(res.tokens);
  useAuthStore.getState().setUser(res.user);
  await loadAssociationsAndMembership();
}

/** Called once at app startup (after hydrateAuth) to restore a session. */
export async function bootstrapSession(): Promise<SessionStatus> {
  if (!tokenCache.hasSession()) return 'unauthenticated';
  try {
    const me = await authApi.me();
    useAuthStore.getState().setUser(me);
    await loadAssociationsAndMembership();
    return 'authenticated';
  } catch {
    // a 401 here already triggers clearAuth via the response interceptor
    return 'unauthenticated';
  }
}

/** Switch the active association (multi-tenant). */
export async function switchAssociation(assoc: Association): Promise<void> {
  await authApi.selectAssociation(assoc.slug);
  useAuthStore.getState().setActiveAssociation(assoc);
  await resolveCurrentMembership();
}

export async function logout(): Promise<void> {
  await useAuthStore.getState().logout();
}
