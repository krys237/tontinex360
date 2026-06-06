// Ported from web front (src/lib/types/finance.ts) — fields trimmed to what mobile uses.
export interface Contribution {
  id: string;
  session: string;
  membership: string;
  member_name?: string;
  tontine_type: string;
  num_shares?: number;
  rate_per_share?: number | string;
  expected_amount: number;
  paid_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'defaulted';
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
  amount: number;
  interest_rate: number;
  total_due: number;
  total_repaid: number;
  remaining: number;
  status: LoanStatus;
  session_granted?: string | null;
  due_date?: string | null;
  purpose?: string;
  approved_by?: string | null;
  created_at: string;
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
