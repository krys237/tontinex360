import api from './client';

export type ImportMode = 'direct' | 'invite';
export type ImportRowValidation = 'ok' | 'duplicate' | 'invalid' | 'doublon_fichier';
export type ImportRowStatus = 'pending' | 'success' | 'error' | 'skipped';
export type ImportBatchStatus = 'previewed' | 'processing' | 'completed' | 'failed';

export interface ParsedRow {
  row_number: number;
  raw_data: Record<string, string>;
  parsed_telephone: string;
  parsed_first_name: string;
  parsed_last_name: string;
  parsed_email: string;
  parsed_member_number: string;
  validation: ImportRowValidation;
  validation_message: string;
}

export interface PreviewResponse {
  rows: ParsedRow[];
  stats: {
    total: number;
    ok: number;
    duplicate: number;
    invalid: number;
    doublon_fichier: number;
  };
  errors: string[];
}

export interface ImportRow {
  id: string;
  row_number: number;
  parsed_telephone: string;
  parsed_first_name: string;
  parsed_last_name: string;
  parsed_email: string;
  parsed_member_number: string;
  status: ImportRowStatus;
  error_message: string;
  resulting_membership?: string | null;
  resulting_invitation_id?: string | null;
}

export interface ImportBatch {
  id: string;
  filename: string;
  mode: ImportMode;
  status: ImportBatchStatus;
  total_rows: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
  imported_by: string;
  created_at: string;
  processed_at?: string | null;
  rows?: ImportRow[];
  stats?: { total: number; success: number; error: number; skipped: number };
}

export const memberImportsApi = {
  list: () =>
    api.get<ImportBatch[]>('/members/imports/').then(r => r.data),
  get: (id: string) =>
    api.get<ImportBatch>(`/members/imports/${id}/`).then(r => r.data),

  preview: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<PreviewResponse>(
      '/members/imports/preview/',
      fd,
      { headers: { 'Content-Type': undefined as any } },
    ).then(r => r.data);
  },

  import: (file: File, mode: ImportMode) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    return api.post<ImportBatch>(
      '/members/imports/',
      fd,
      { headers: { 'Content-Type': undefined as any } },
    ).then(r => r.data);
  },

  templateUrl: () => {
    const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
    return `${base}/members/imports/template/`;
  },
};
