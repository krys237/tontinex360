export function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' XAF';
}

/**
 * Formate un montant en respectant le type de cotisation.
 * - 'cash' → "10 000 XAF"
 * - 'in_kind' → "3 Sac de riz 25kg" (avec valeur XAF équivalente en sous-titre via formatInKindEquivalent)
 */
export function formatContributionAmount(
  amount: number,
  opts?: { kind?: 'cash' | 'in_kind'; unitLabel?: string },
): string {
  const kind = opts?.kind ?? 'cash';
  if (kind === 'in_kind') {
    const unit = (opts?.unitLabel || 'unités').trim();
    const qty = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount);
    return `${qty} ${unit}`;
  }
  return formatXAF(amount);
}

/** Valeur XAF équivalente d'une quantité en nature. */
export function formatInKindEquivalent(
  quantity: number,
  unitValue?: number | null,
): string | null {
  if (!unitValue || unitValue <= 0 || !quantity) return null;
  return `≈ ${formatXAF(quantity * unitValue)}`;
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return Math.round(amount / 1_000_000) + 'M';
  if (amount >= 1_000) return Math.round(amount / 1_000) + 'K';
  return String(Math.round(amount));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });
}

export function formatRelative(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return `Il y a ${diff} jours`;
  return formatShortDate(date);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
