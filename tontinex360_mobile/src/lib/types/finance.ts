// Ported from web front (src/lib/types/finance.ts) — fields trimmed to what mobile uses.
export type ContributionStatus =
  | 'pending'
  | 'submitted'
  | 'paid'
  | 'partial'
  | 'rejected'
  | 'defaulted';

export interface Contribution {
  id: string;
  session: string;
  membership: string;
  member_name?: string;
  tontine_type: string;
  tontine_type_name?: string;
  num_shares?: number;
  rate_per_share?: number | string;
  expected_amount: number;
  paid_amount: number;
  status: ContributionStatus;
  payment_method?: string;
  paid_at?: string;
  has_receipt?: boolean;
  has_pending_correction?: boolean;
  contribution_kind?: 'cash' | 'in_kind';
  in_kind_unit_label?: string;
  in_kind_unit_value?: number | null;
}

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'disbursed'
  | 'repaying'
  | 'repaid'
  | 'defaulted';

export interface Loan {
  id: string;
  membership: string;
  member_name?: string;
  amount: number;
  approved_amount?: number | null;
  interest_rate: number;
  total_due: number;
  total_repaid: number;
  remaining: number;
  status: LoanStatus | string;
  session_granted?: string | null;
  due_date?: string | null;
  duration_days?: number;
  purpose?: string;
  reason?: string;
  approved_by?: string | null;
  created_at: string;
}

// ---------- Remboursements ----------
export interface LoanRepayment {
  id: string;
  loan: string;
  session?: string | null;
  amount: number | string;
  paid_at: string;
  payment_method?: string;
  notes?: string;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
}

// ---------- Trésorerie ----------
export interface TreasuryAccount {
  id: string;
  name: string;
  account_type: 'cash' | 'bank' | 'mobile_money' | string;
  balance: number | string;
  is_active?: boolean;
  description?: string;
}

// ---------- Demandes de correction de cotisation (double validation) ----------
export type CorrectionRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface ContributionCorrectionRequest {
  id: string;
  contribution: string;
  member_name?: string;
  current_paid_amount?: number | string;
  new_paid_amount: number | string;
  reason: string;
  status: CorrectionRequestStatus;
  requested_by?: string;
  requested_by_name?: string;
  approved_by?: string | null;
  rejection_reason?: string;
  expires_at?: string | null;
  created_at: string;
}

// ---------- Config des prêts ----------
export interface LoanSettings {
  default_interest_rate: number;
  min_interest_rate: number;
  max_interest_rate: number;
  max_amount: number | null;
  max_duration_days: number;
  auto_approve_threshold: number;
  require_guarantor: boolean;
  treasury_buffer_pct: number;
  modifiable_by_permissions: string[];
  can_modify?: boolean;
}

export interface LoanCapacity {
  total_treasury: string;
  buffer_pct: number;
  reserved_buffer: string;
  outstanding_loans: string;
  available: string;
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
