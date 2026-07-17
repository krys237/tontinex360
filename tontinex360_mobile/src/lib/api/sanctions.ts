// Sanctions (bureau) — porté du web front (src/lib/api/sanctions.ts).
import api, { unwrap, Paginated } from './client';

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

export type SanctionStatus =
  | 'pending'
  | 'submitted'
  | 'paid'
  | 'rejected'
  | 'waived'
  | 'contested';

export interface Sanction {
  id: string;
  sanction_type: string;
  type_name?: string;
  membership: string;
  member_name?: string;
  session?: string | null;
  amount: number | string;
  reason: string;
  status: SanctionStatus;
  paid_at?: string | null;
  applied_by?: string | null;
  created_at?: string;
  has_receipt?: boolean;
  // ── Workflow paiement self-service (soumettre → valider/rejeter) ──
  payment_method?: string;
  submitted_justification?: string | null;
  submitted_at?: string | null;
  validated_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string;
}

export const sanctionsApi = {
  // Types
  types: (params?: { is_active?: boolean }) =>
    api.get<SanctionType[] | Paginated<SanctionType>>('/sanctions/types/', { params }).then((r) => unwrap(r.data)),
  getType: (id: string) => api.get<SanctionType>(`/sanctions/types/${id}/`).then((r) => r.data),
  createType: (data: Partial<SanctionType>) =>
    api.post<SanctionType>('/sanctions/types/', data).then((r) => r.data),
  updateType: (id: string, data: Partial<SanctionType>) =>
    api.patch<SanctionType>(`/sanctions/types/${id}/`, data).then((r) => r.data),
  removeType: (id: string) => api.delete(`/sanctions/types/${id}/`).then((r) => r.data),

  // Sanctions appliquées
  list: (params?: Record<string, string>) =>
    api.get<Sanction[] | Paginated<Sanction>>('/sanctions/sanctions/', { params }).then((r) => unwrap(r.data)),
  get: (id: string) => api.get<Sanction>(`/sanctions/sanctions/${id}/`).then((r) => r.data),
  create: (data: Partial<Sanction>) =>
    api.post<Sanction>('/sanctions/sanctions/', data).then((r) => r.data),
  update: (id: string, data: Partial<Sanction>) =>
    api.patch<Sanction>(`/sanctions/sanctions/${id}/`, data).then((r) => r.data),

  signReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api
      .post<Sanction>(`/sanctions/sanctions/${id}/sign_receipt/`, { signature, device_info: deviceInfo ?? {} })
      .then((r) => r.data),

  // ── Self-service membre : soumettre → valider/rejeter (bureau) ──
  /** Sanctions du membre courant. */
  mySanctions: () =>
    api.get<Sanction[] | Paginated<Sanction>>('/sanctions/sanctions/mine/').then((r) => unwrap(r.data)),

  /** Le membre soumet le paiement d'une sanction (statut → submitted). Preuve
   *  photo optionnelle jointe en multipart. Le bureau valide ensuite. */
  submitPayment: (
    id: string,
    paymentMethod: string,
    proof?: { uri: string; name: string; type: string } | null,
  ) => {
    const url = `/sanctions/sanctions/${id}/pay/`;
    if (proof) {
      const form = new FormData();
      form.append('payment_method', paymentMethod);
      form.append('submitted_justification', proof as any);
      return api
        .post<Sanction>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data);
    }
    return api.post<Sanction>(url, { payment_method: paymentMethod }).then((r) => r.data);
  },

  /** Bureau : valide un paiement soumis (→ paid + distribution). */
  validatePayment: (id: string) =>
    api.post<Sanction>(`/sanctions/sanctions/${id}/validate_payment/`).then((r) => r.data),

  /** Bureau : rejette un paiement soumis (motif ≥ 5 caractères). */
  rejectPayment: (id: string, reason: string) =>
    api.post<Sanction>(`/sanctions/sanctions/${id}/reject_payment/`, { reason }).then((r) => r.data),
};
