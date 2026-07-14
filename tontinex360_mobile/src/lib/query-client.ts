import { QueryClient } from '@tanstack/react-query';

/**
 * Instance unique de React Query, définie hors de React pour que la couche
 * session (`auth/session.ts`, `stores/auth-store.ts`) puisse vider le cache
 * quand l'identité change.
 *
 * Indispensable : les clés de requête (`['tontines','subs']`, `['bureau','cycles']`…)
 * ne sont scopées ni par utilisateur ni par association — le tenant voyage dans
 * le header `X-Tenant`, pas dans la clé. Sans purge explicite, un écran remonté
 * après un changement de compte ou d'association sert d'abord les données du
 * précédent (gcTime = 5 min) avant de se corriger, et les conserve durablement
 * si le refetch échoue.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
