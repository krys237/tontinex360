export interface Contribution {
  id: string;
  session: string;
  membership: string;
  member_name?: string;
  tontine_type: string;
  expected_amount: number;
  paid_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'defaulted';
  payment_method?: string;
  receipt_number?: string;
  paid_at?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
  has_pending_correction?: boolean;
  // Métadonnées héritées du TontineType (lecture seule)
  contribution_kind?: 'cash' | 'in_kind';
  in_kind_unit_label?: string;
  in_kind_unit_value?: number | null;
}

export type CorrectionRequestStatus =
  | 'pending' | 'pres_approved' | 'bureau_approved'
  | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface ContributionCorrectionRequest {
  id: string;
  contribution: string;
  requested_by: string;
  requested_by_name: string;
  member_name: string;
  tontine_type_name?: string;
  expected_amount: number | string;
  original_paid_amount: number | string;
  new_paid_amount: number | string;
  original_status: string;
  new_status: string;
  reason: string;
  president_approval?: string | null;
  president_approval_name?: string | null;
  president_approval_at?: string | null;
  bureau_approval?: string | null;
  bureau_approval_name?: string | null;
  bureau_approval_at?: string | null;
  rejected_by?: string | null;
  rejected_by_name?: string | null;
  rejection_reason?: string;
  status: CorrectionRequestStatus;
  applied_at?: string | null;
  expires_at: string;
  is_expired: boolean;
  created_at: string;
}

export interface Loan {
  id: string;
  membership: string;
  member_name: string;
  amount: number;
  interest_rate: number;
  total_due: number;
  amount_repaid: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'repaid' | 'defaulted';
  session_granted?: string;
  due_date: string;
  created_at: string;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  account: string;
  transaction_type: string;
  amount: number;
  is_debit: boolean;
  balance_after: number;
  description: string;
  session?: string;
  membership?: string;
  created_at: string;
}
