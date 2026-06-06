'use client';
import { useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  hasPermission, isBureau, isPresident, isLambda,
  getEffectivePermissions, activeRoles, getLandingPath,
} from '@/lib/utils/permissions';

/**
 * Hook utilitaire pour les vérifications de permissions dans les composants.
 *
 * Usage :
 *   const { can, isBureau, isPresident, landingPath } = usePermissions();
 *   if (can('finance.collect')) { ... }
 *   if (isBureau) { ... }
 */
export function usePermissions() {
  const { currentMembership } = useAuthStore();
  const roles = currentMembership?.roles;

  return useMemo(() => ({
    membership: currentMembership,
    roles: activeRoles(roles),

    can: (permission: string) => hasPermission(roles, permission),

    canAny: (permissions: string[]) =>
      permissions.some(p => hasPermission(roles, p)),

    canAll: (permissions: string[]) =>
      permissions.every(p => hasPermission(roles, p)),

    isBureau: isBureau(currentMembership),
    isPresident: isPresident(currentMembership),
    isLambda: isLambda(currentMembership),

    permissions: getEffectivePermissions(roles),

    landingPath: getLandingPath(currentMembership ?? null),
  }), [currentMembership, roles]);
}
