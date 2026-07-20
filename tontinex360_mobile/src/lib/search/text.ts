/**
 * Primitives de recherche textuelle côté client, partagées par la recherche
 * globale (catalogue de modules) et la recherche intra-tuile (filtrage de liste).
 */

/** Minuscule + sans accents/diacritiques, pour un match tolérant. */
export function normalize(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Découpe une requête en termes normalisés non vides. */
export function tokens(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * Vrai si TOUS les termes de la requête apparaissent dans le haystack.
 * Le haystack est la concaténation des champs cherchables d'un élément.
 */
export function matchesAllTerms(haystack: string, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = normalize(haystack);
  return terms.every((t) => hay.includes(t));
}

/**
 * Filtre une liste : garde les éléments dont les champs extraits par `fields`
 * contiennent tous les termes de la requête. Requête vide → liste inchangée.
 */
export function filterByQuery<T>(
  items: T[],
  query: string,
  fields: (item: T) => Array<string | number | null | undefined>,
): T[] {
  const terms = tokens(query);
  if (!terms.length) return items;
  return items.filter((it) => matchesAllTerms(fields(it).join(' '), terms));
}
