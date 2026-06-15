import React from 'react';
import { usePermissions } from '../../lib/hooks/use-permissions';

/**
 * Masque ses enfants selon les permissions du membre courant.
 * Purement cosmétique — le backend reste l'autorité (gérer les 403).
 *
 *   <RequirePermission anyOf={['members.invite']}>...</RequirePermission>
 *   <RequirePermission president>...</RequirePermission>
 */
export default function RequirePermission({
  anyOf,
  allOf,
  president,
  bureau,
  fallback = null,
  children,
}: {
  anyOf?: string[];
  allOf?: string[];
  president?: boolean;
  bureau?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const p = usePermissions();

  let ok = true;
  if (president) ok = ok && p.isPresident;
  if (bureau) ok = ok && p.isBureau;
  if (anyOf && anyOf.length) ok = ok && p.canAny(anyOf);
  if (allOf && allOf.length) ok = ok && p.canAll(allOf);

  return <>{ok ? children : fallback}</>;
}
