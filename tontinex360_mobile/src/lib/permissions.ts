// Ported from the web front (src/lib/utils/permissions.ts).
// Wildcard rules: "*" = all, "app.*" = whole app namespace, "app.action" = exact.
import type { Membership, MemberRole, Role } from './types/member';

export function hasPermission(
  roles: MemberRole[] | undefined | null,
  permission: string,
): boolean {
  if (!roles) return false;
  for (const mr of roles) {
    if (!mr.is_active) continue;
    const perms = mr.role?.permissions ?? [];
    for (const perm of perms) {
      if (perm === '*') return true;
      if (perm === permission) return true;
      if (perm.endsWith('.*')) {
        const prefix = perm.slice(0, -2) + '.';
        if (permission.startsWith(prefix)) return true;
      }
    }
  }
  return false;
}

export function isBureau(membership: Membership | null | undefined): boolean {
  if (!membership) return false;
  if (membership.is_founder) return true;
  return (membership.roles ?? []).some(
    (mr) => mr.is_active && mr.role?.is_bureau_role === true,
  );
}

export function isPresident(membership: Membership | null | undefined): boolean {
  if (!membership) return false;
  if (membership.is_founder) return true;
  const roles = membership.roles;
  if (hasPermission(roles, '*')) return true;
  return (roles ?? []).some(
    (mr) =>
      mr.is_active &&
      mr.role?.is_bureau_role === true &&
      mr.role?.hierarchy_level === 0,
  );
}

export function isLambda(membership: Membership | null | undefined): boolean {
  return !isBureau(membership);
}

export function getEffectivePermissions(
  roles: MemberRole[] | undefined | null,
): string[] {
  if (!roles) return [];
  const out = new Set<string>();
  for (const mr of roles) {
    if (!mr.is_active) continue;
    for (const p of mr.role?.permissions ?? []) out.add(p);
  }
  return Array.from(out);
}

export function activeRoles(roles: MemberRole[] | undefined | null): Role[] {
  if (!roles) return [];
  return roles.filter((mr) => mr.is_active && !!mr.role).map((mr) => mr.role);
}

/**
 * Mobile landing screen after login, mirroring the web getLandingPath rules
 * but returning a drawer route name.
 *   President / bureau            -> 'Dashboard'
 *   Lambda member                 -> 'MyWallet'
 */
export type AppRoute = 'Dashboard' | 'MyWallet';

export function getLandingRoute(membership: Membership | null | undefined): AppRoute {
  if (isBureau(membership)) return 'Dashboard';
  return 'MyWallet';
}
