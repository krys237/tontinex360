// Mirrors the web usePermissions() hook.
import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth-store';
import {
  hasPermission,
  isBureau,
  isPresident,
  isLambda,
  getEffectivePermissions,
  activeRoles,
  getLandingRoute,
} from '../permissions';

export function usePermissions() {
  const currentMembership = useAuthStore((s) => s.currentMembership);
  const roles = currentMembership?.roles;

  return useMemo(
    () => ({
      membership: currentMembership,
      roles: activeRoles(roles),

      can: (permission: string) => hasPermission(roles, permission),
      canAny: (permissions: string[]) => permissions.some((p) => hasPermission(roles, p)),
      canAll: (permissions: string[]) => permissions.every((p) => hasPermission(roles, p)),

      isBureau: isBureau(currentMembership),
      isPresident: isPresident(currentMembership),
      isLambda: isLambda(currentMembership),

      permissions: getEffectivePermissions(roles),
      landingRoute: getLandingRoute(currentMembership ?? null),
    }),
    [currentMembership, roles],
  );
}
