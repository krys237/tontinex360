// Import de membres (bureau) — porté du web front (src/lib/api/member-imports.ts).
// NB : la sélection/upload de fichier (.xlsx) nécessitera `expo-document-picker`
// (non installé). Seuls la liste/historique et les types sont disponibles ici ;
// preview() / import() seront branchés quand le picker sera ajouté.
import api, { unwrap, Paginated } from './client';

export type ImportMode = 'invite' | 'direct';

export interface ImportBatch {
  id: string;
  filename: string | null;
  imported_by: string;
  mode: ImportMode;
  success_count: number;
  skipped_count: number;
  error_count: number;
  created_at: string;
}

export const memberImportsApi = {
  list: () =>
    api
      .get<ImportBatch[] | Paginated<ImportBatch>>('/members/imports/')
      .then((r) => unwrap(r.data)),
};
