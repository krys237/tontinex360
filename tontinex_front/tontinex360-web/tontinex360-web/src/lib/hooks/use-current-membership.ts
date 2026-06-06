'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { membersApi } from '@/lib/api/members';
import type { Membership } from '@/lib/types/member';

/**
 * Récupère et met en cache le membership courant de l'utilisateur connecté
 * pour l'association active (avec ses rôles et permissions).
 *
 * Le backend ne fournit pas d'endpoint dédié /me-membership/ ; on fait donc
 * GET /members/memberships/ avec X-Tenant injecté par l'intercepteur, puis
 * on filtre par user.id côté client. Il y a au plus 1 résultat dans le cas
 * normal (un User ↔ un Membership par Association).
 */
export function useCurrentMembership() {
  const { user, activeAssociation, currentMembership, setCurrentMembership } = useAuthStore();

  const enabled = !!user?.telephone && !!activeAssociation?.slug;

  const query = useQuery<Membership | null>({
    queryKey: ['current-membership', user?.id, activeAssociation?.slug],
    enabled,
    queryFn: async () => {
      if (!user?.telephone) return null;

      // GET tous les memberships du tenant (le X-Tenant filtre auto)
      // Pas de `search` car le param peut ne pas être configuré côté ViewSet
      // et le `+` du téléphone pose des soucis d'encodage.
      const list = await membersApi.list();

      const norm = (s: string | null | undefined) =>
        (s || '').replace(/[\s-]/g, '').toLowerCase();
      const myTel = norm(user.telephone);
      const lite = list.find(m => norm(m.user_telephone) === myTel);
      if (!lite) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(
            '[useCurrentMembership] Aucun membership trouvé pour',
            user.telephone, 'parmi', list.length, 'memberships'
          );
        }
        return null;
      }

      const full = await membersApi.get(lite.id);
      return full;
    },
    staleTime: 5 * 60_000, // 5 min — évite les refetches inutiles
    retry: 1, // un seul retry en cas d'erreur (CORS, 403…)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (query.data && query.data !== currentMembership) {
      setCurrentMembership(query.data);
    }
  }, [query.data]);

  return {
    membership: query.data ?? currentMembership,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
