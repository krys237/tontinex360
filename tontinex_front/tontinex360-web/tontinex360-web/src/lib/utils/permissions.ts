import type { Membership, MemberRole, Role } from '@/lib/types/member';

/**
 * Vérifie si un membre a une permission donnée.
 * Supporte les wildcards :
 *   - "*"     → toutes permissions
 *   - "app.*" → toutes les permissions de l'app (ex : "finance.*")
 *   - "app.action" → permission exacte
 */
export function hasPermission(roles: MemberRole[] | undefined | null, permission: string): boolean {
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

/**
 * Vrai si le membre a au moins un rôle marqué `is_bureau_role=true`,
 * OU s'il est le fondateur de l'association (is_founder=true).
 */
export function isBureau(membership: Membership | null | undefined): boolean {
  if (!membership) return false;
  if (membership.is_founder) return true;
  return (membership.roles ?? []).some(
    mr => mr.is_active && mr.role?.is_bureau_role === true,
  );
}

/**
 * Vrai si le membre est président / fondateur :
 *   - is_founder=true (cas le plus solide)
 *   - OU permission `*`
 *   - OU rôle de bureau avec hierarchy_level === 0
 */
export function isPresident(membership: Membership | null | undefined): boolean {
  if (!membership) return false;
  if (membership.is_founder) return true;
  const roles = membership.roles;
  if (hasPermission(roles, '*')) return true;
  return (roles ?? []).some(mr =>
    mr.is_active
    && mr.role?.is_bureau_role === true
    && (mr.role?.hierarchy_level === 0)
  );
}

/**
 * Vrai si le membre n'a aucun rôle de bureau (membre lambda).
 */
export function isLambda(membership: Membership | null | undefined): boolean {
  return !isBureau(membership);
}

/**
 * Renvoie les permissions agrégées du membre (utile pour debug/affichage).
 */
export function getEffectivePermissions(roles: MemberRole[] | undefined | null): string[] {
  if (!roles) return [];
  const out = new Set<string>();
  for (const mr of roles) {
    if (!mr.is_active) continue;
    for (const p of mr.role?.permissions ?? []) out.add(p);
  }
  return Array.from(out);
}

/**
 * Renvoie les rôles actifs (Role[]) du membre.
 */
export function activeRoles(roles: MemberRole[] | undefined | null): Role[] {
  if (!roles) return [];
  return roles.filter(mr => mr.is_active && !!mr.role).map(mr => mr.role);
}

/**
 * Détermine la page d'atterrissage post-login d'un membre selon ses droits.
 *
 * Règles validées avec le PO :
 *   - Bureau (membres avec is_bureau_role=true) → /dashboard (vue globale ou filtrée par leur rôle)
 *   - Membre lambda → pas d'accès au dashboard. Web réservé si le membre n'a pas
 *     de mobile : il accède uniquement à ses informations + son wallet/finance.
 *     Page d'atterrissage : /wallets/me
 */
export function getLandingPath(membership: Membership | null | undefined): string {
  if (!membership) return '/login';
  const roles = membership.roles;

  if (isPresident(membership)) return '/dashboard';
  if (hasPermission(roles, 'finance.*') || hasPermission(roles, 'finance.collect')) {
    return '/finance/contributions';
  }
  if (hasPermission(roles, 'members.*') || hasPermission(roles, 'governance.*')) {
    return '/members';
  }
  if (isBureau(membership)) return '/dashboard';

  // Membre lambda : pas de dashboard, vue limitée
  return '/wallets/me';
}
