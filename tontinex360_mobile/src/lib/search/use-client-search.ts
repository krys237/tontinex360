import { useMemo, useState } from 'react';
import { filterByQuery } from './text';

/** Plafond de pagination du client (voir client.ts : page_size forcé à 200). */
const PAGE_CAP = 200;

/**
 * Recherche intra-tuile côté client : filtre une liste déjà chargée sur les
 * champs texte extraits par `fields`. Sans coût réseau, instantané.
 *
 * `capped` est vrai quand la liste atteint le plafond de pagination (200) : dans
 * ce cas le filtrage ne porte que sur les éléments chargés, pas sur toute la base.
 * L'écran DOIT alors afficher un avertissement honnête (« recherche limitée aux
 * 200 éléments chargés »). Pour une recherche exhaustive sur ces gros volumes, il
 * faudrait un `?search=` serveur (cf. Membres) — non retenu ici.
 */
export function useClientSearch<T>(
  items: T[] | undefined,
  fields: (item: T) => Array<string | number | null | undefined>,
) {
  const [query, setQuery] = useState('');
  const list = items ?? [];
  const filtered = useMemo(() => filterByQuery(list, query, fields), [list, query, fields]);
  const capped = list.length >= PAGE_CAP && query.trim().length > 0;
  return { query, setQuery, filtered, capped, hasQuery: query.trim().length > 0 };
}
