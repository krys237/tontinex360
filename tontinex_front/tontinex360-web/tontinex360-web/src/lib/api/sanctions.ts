import api from './client';

export interface SanctionType {
  id: string;
  name: string;
  slug: string;
  description: string;
  default_amount: number | string | null;
  is_fixed_amount: boolean;
  min_amount?: number | string | null;
  max_amount?: number | string | null;
  is_automatic: boolean;
  is_active: boolean;
}

export interface Sanction {
  id: string;
  sanction_type: string;
  type_name?: string;
  membership: string;
  member_name?: string;
  session?: string | null;
  amount: number | string;
  reason: string;
  status: 'pending' | 'paid' | 'waived' | 'contested';
  paid_at?: string | null;
  applied_by?: string | null;
  created_at?: string;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
}

export const sanctionsApi = {
  // Types
  types: (params?: { is_active?: boolean }) =>
    api.get<SanctionType[]>('/sanctions/types/', { params }).then(r => r.data),
  createType: (data: Partial<SanctionType>) =>
    api.post<SanctionType>('/sanctions/types/', data).then(r => r.data),
  updateType: (id: string, data: Partial<SanctionType>) =>
    api.patch<SanctionType>(`/sanctions/types/${id}/`, data).then(r => r.data),
  removeType: (id: string) =>
    api.delete(`/sanctions/types/${id}/`).then(r => r.data),

  // Sanctions appliquées
  list: (params?: Record<string, string>) =>
    api.get<Sanction[]>('/sanctions/sanctions/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Sanction>(`/sanctions/sanctions/${id}/`).then(r => r.data),
  create: (data: Partial<Sanction>) =>
    api.post<Sanction>('/sanctions/sanctions/', data).then(r => r.data),
  update: (id: string, data: Partial<Sanction>) =>
    api.patch<Sanction>(`/sanctions/sanctions/${id}/`, data).then(r => r.data),

  signReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api.post<Sanction>(`/sanctions/sanctions/${id}/sign_receipt/`, {
      signature, device_info: deviceInfo ?? {},
    }).then(r => r.data),
};
