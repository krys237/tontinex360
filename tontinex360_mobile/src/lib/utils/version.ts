/**
 * Comparaison de versions semver simples ("1.2.3").
 * Retourne -1 si a < b, 0 si égales, 1 si a > b.
 * Tolérant : segments manquants = 0, segments non numériques = 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** `current` est-elle strictement plus ancienne que `latest` ? */
export function isOutdated(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}
