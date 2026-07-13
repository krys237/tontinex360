// Frais d'adhésion (bureau) — porté du web front (src/lib/api/member-fees.ts).
import api, { unwrap, Paginated } from './client';

export type FeeType = 'registration' | 'membership_fund';
export type FeeStatus = 'pending' | 'partial' | 'paid' | 'waived';
export type FundScope = 'lifetime' | 'per_cycle';

export interface MembershipFeesConfig {
  registration: {
    enabled: boolean;
    amount: number;
    is_entry_gate: boolean;
  };
  membership_fund: {
    enabled: boolean;
    amount: number;
    scope: FundScope;
    allow_partial: boolean;
    blocks_access: boolean;
  };
}

export interface MembershipFeePayment {
  id: string;
  membership: string;
  member_name: string;
  fee_type: FeeType;
  fee_type_display: string;
  expected_amount: string;
  paid_amount: string;
  remaining_amount: string;
  progress_pct: number;
  status: FeeStatus;
  status_display: string;
  created_at: string;
}

export interface PendingOverviewRow {
  membership_id: string;
  member_name: string;
  member_status: string;
  total_expected: string;
  total_paid: string;
  total_remaining: string;
  fees: MembershipFeePayment[];
}

export const memberFeesApi = {
  // Configuration association
  getConfig: () => api.get<MembershipFeesConfig>('/members/fees/config/').then((r) => r.data),
  updateConfig: (data: Partial<MembershipFeesConfig>) =>
    api.patch<MembershipFeesConfig>('/members/fees/config/', data).then((r) => r.data),

  // Versements
  list: (params?: { membership?: string; status?: string; fee_type?: string }) =>
    api
      .get<MembershipFeePayment[] | Paginated<MembershipFeePayment>>('/members/fees/', { params })
      .then((r) => unwrap(r.data)),
  record: (id: string, data: { amount: number; payment_method?: string; notes?: string }) =>
    api.post(`/members/fees/${id}/record/`, data).then((r) => r.data),

  // Vue d'ensemble trésorier (membres avec frais en retard)
  pendingOverview: () =>
    api
      .get<PendingOverviewRow[] | Paginated<PendingOverviewRow>>('/members/fees/pending-overview/')
      .then((r) => unwrap(r.data)),
};
