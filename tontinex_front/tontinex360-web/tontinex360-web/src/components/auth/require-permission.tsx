'use client';
import { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/use-permissions';

interface RequirePermissionProps {
  /** Permission unique requise (ex : "finance.collect") */
  permission?: string;
  /** Au moins une de ces permissions */
  anyOf?: string[];
  /** Toutes ces permissions */
  allOf?: string[];
  /** Restriction au bureau */
  bureau?: boolean;
  /** Restriction au président / fondateur */
  president?: boolean;
  /** Affichage si refusé (par défaut : null) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Cache son contenu si l'utilisateur n'a pas les droits demandés.
 *
 * Exemples :
 *   <RequirePermission permission="finance.collect">...</RequirePermission>
 *   <RequirePermission anyOf={["members.create", "members.invite"]}>...</RequirePermission>
 *   <RequirePermission bureau>...</RequirePermission>
 *   <RequirePermission president>...</RequirePermission>
 */
export function RequirePermission({
  permission, anyOf, allOf, bureau, president,
  fallback = null, children,
}: RequirePermissionProps) {
  const p = usePermissions();

  let allowed = true;

  if (president) allowed = allowed && p.isPresident;
  if (bureau) allowed = allowed && p.isBureau;
  if (permission) allowed = allowed && p.can(permission);
  if (anyOf?.length) allowed = allowed && p.canAny(anyOf);
  if (allOf?.length) allowed = allowed && p.canAll(allOf);

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
