/**
 * Session orchestration: login, startup bootstrap, association switching, logout.
 * These are plain async functions operating on the auth store + secure storage,
 * so they can be called from screens or from App startup alike.
 */
import { authApi } from '../api/auth';
import { membersApi } from '../api/members';
import { useAuthStore } from '../stores/auth-store';
import { saveTokens, tokenCache } from '../storage/secure-storage';
import { queryClient } from '../query-client';
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

/** Re-fetch associations + membership (e.g. after creating an association,
 *  or quand une demande d'adhésion vient d'être approuvée). */
export async function refreshWorkspace(): Promise<void> {
  const { associations, active } = await fetchWorkspace();
  commitWorkspace(associations, active);
  if (active) await resolveCurrentMembership();
}

/** Récupère les associations de l'utilisateur et calcule laquelle doit être active.
 *  Sélection de l'asso active :
 *   - si le backend a mémorisé une asso active (active_slug) → on la reprend
 *   - sinon, s'il n'y en a qu'une seule → on entre directement
 *   - sinon (0 ou plusieurs sans choix) → null → écran d'onboarding
 *     (Bienvenue / Mes associations). */
async function fetchWorkspace(): Promise<{ associations: Association[]; active: Association | null }> {
  const { associations, active_slug } = await authApi.myAssociations();
  let active = active_slug ? associations.find((a) => a.slug === active_slug) ?? null : null;
  if (!active && associations.length === 1) active = associations[0];
  return { associations, active };
}

/** Pose associations + asso active en UN seul lot synchrone. Critique : appelé
 *  juste après setUser sans await intercalé, pour que user + associations + active
 *  atterrissent dans le même cycle de rendu. Sinon WorkspaceStack se monte pendant
 *  que `associations` est encore vide et gèle son initialRoute sur 'NoAssociation'. */
function commitWorkspace(associations: Association[], active: Association | null): void {
  const store = useAuthStore.getState();
  store.setAssociations(associations);
  store.setActiveAssociation(active); // also syncs the X-Tenant slug
}

/** Load the user's associations, pick the active one, then resolve membership. */
async function loadAssociationsAndMembership(): Promise<void> {
  const { associations, active } = await fetchWorkspace();
  commitWorkspace(associations, active);
  if (active) await resolveCurrentMembership();
}

/** Phone + password login. */
export async function loginWithPassword(
  telephone: string,
  password: string,
): Promise<void> {
  const res = await authApi.login({ telephone, password });
  await saveTokens(res.tokens);
  // On charge les associations AVANT de poser le user, puis on écrit user +
  // associations + active d'affilée (sans await entre) : le premier rendu où
  // `user` est vrai voit déjà le bon nombre d'associations → WorkspaceStack
  // choisit ChooseAssociation vs NoAssociation correctement du premier coup.
  const { associations, active } = await fetchWorkspace();
  useAuthStore.getState().setUser(res.user);
  commitWorkspace(associations, active);
  if (active) await resolveCurrentMembership();
}

/** Called once at app startup (after hydrateAuth) to restore a session. */
export async function bootstrapSession(): Promise<SessionStatus> {
  if (!tokenCache.hasSession()) return 'unauthenticated';
  try {
    const me = await authApi.me();
    const { associations, active } = await fetchWorkspace();
    useAuthStore.getState().setUser(me);
    commitWorkspace(associations, active);
    if (active) await resolveCurrentMembership();
    return 'authenticated';
  } catch {
    // a 401 here already triggers clearAuth via the response interceptor
    return 'unauthenticated';
  }
}

/** Switch the active association (multi-tenant). */
export async function switchAssociation(assoc: Association): Promise<void> {
  await authApi.selectAssociation(assoc.slug);
  // setActiveAssociation met d'abord à jour le slug X-Tenant : la purge doit
  // venir APRÈS, sinon les refetch déclenchés repartiraient sur l'ancien tenant.
  useAuthStore.getState().setActiveAssociation(assoc);
  // Le tenant voyage dans un header, pas dans les clés de requête : sans purge,
  // les écrans affichent les données de l'association précédente.
  queryClient.clear();
  await resolveCurrentMembership();
}

export async function logout(): Promise<void> {
  await useAuthStore.getState().logout();
}
