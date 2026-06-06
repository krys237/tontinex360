import api from './client';

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

export interface FeeInstallment {
  id: string;
  amount: string;
  paid_at: string;
  payment_method: string;
  recorded_by?: string | null;
  recorded_by_name?: string | null;
  transaction_id?: string | null;
  wallet_entry_id?: string | null;
  notes: string;
  created_at: string;
}

export interface MembershipFeePayment {
  id: string;
  membership: string;
  member_name: string;
  fee_type: FeeType;
  fee_type_display: string;
  cycle?: string | null;
  cycle_name?: string | null;
  expected_amount: string;
  paid_amount: string;
  remaining_amount: string;
  progress_pct: number;
  status: FeeStatus;
  status_display: string;
  first_payment_at?: string | null;
  completed_at?: string | null;
  waived_by?: string | null;
  waived_by_name?: string | null;
  waiver_reason?: string;
  notes: string;
  installments: FeeInstallment[];
  created_at: string;
  updated_at: string;
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
  getConfig: () =>
    api.get<MembershipFeesConfig>('/members/fees/config/').then(r => r.data),
  updateConfig: (data: Partial<MembershipFeesConfig>) =>
    api.patch<MembershipFeesConfig>('/members/fees/config/', data).then(r => r.data),

  // FeePayments
  list: (params?: { membership?: string; status?: string; fee_type?: string }) =>
    api.get<MembershipFeePayment[]>('/members/fees/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<MembershipFeePayment>(`/members/fees/${id}/`).then(r => r.data),
  byMembership: (membershipId: string) =>
    api.get<MembershipFeePayment[]>(
      `/members/fees/by-membership/${membershipId}/`,
    ).then(r => r.data),
  record: (id: string, data: { amount: number; payment_method?: string; notes?: string }) =>
    api.post<{
      fee_payment: MembershipFeePayment;
      installment: FeeInstallment;
      transaction_id: string;
      wallet_entry_id: string;
    }>(`/members/fees/${id}/record/`, data).then(r => r.data),

  // Vue d'ensemble pour le trésorier
  pendingOverview: () =>
    api.get<PendingOverviewRow[]>('/members/fees/pending-overview/').then(r => r.data),
};
