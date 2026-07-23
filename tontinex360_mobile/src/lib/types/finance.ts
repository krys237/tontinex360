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
  created_at?: string;
  /** Motif de rejet (renseigné quand status = rejected). */
  rejection_reason?: string;
  /** Contexte séance (exposé par le serializer) : sert à choisir re-cotiser
   *  (séance ouverte) vs demander une correction (séance clôturée). */
  session_status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | '';
  session_number?: number;
  session_date?: string | null;
  /** Justificatif de paiement joint par le membre (self-service). */
  contribution_justification?: string | null;
  /** False tant que le trésorier n'a pas inspecté le justificatif. */
  is_validated?: boolean;
  has_receipt?: boolean;
  has_pending_correction?: boolean;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  contribution_kind?: 'cash' | 'in_kind';
  in_kind_unit_label?: string;
  in_kind_unit_value?: number | null;
}

export interface ArrearsPreviewLine {
  contribution_id: string;
  session_id: string;
  session_number: number;
  session_date: string;
  status: ContributionStatus;
  owed: string;
}

export interface ArrearsPreview {
  membership_id: string;
  tontine_type?: { id: string; name: string };
  session?: { id: string; session_number: number };
  arrears: ArrearsPreviewLine[];
  current?: {
    contribution_id: string | null;
    status: string;
    expected: string;
    already_paid: string;
    owed: string;
  } | null;
  total_arrears?: string;
  total_current?: string;
  total_due: string;
  message?: string;
}

export type LoanStatus =
  | 'pending'
  | 'counter_offered'
  | 'awaiting_guarantors'
  | 'approved'
  | 'disbursed'
  | 'repaying'
  | 'repaid'
  | 'defaulted'
  | 'cancelled';

export interface LoanGuarantorAcceptance {
  id: string;
  loan: string;
  guarantor: string;
  guarantor_name?: string;
  status: 'pending' | 'accepted' | 'declined';
  decided_at?: string | null;
  note?: string;
  created_at: string;
}

export interface Loan {
  id: string;
  membership: string;
  member_name?: string;
  amount: number;
  approved_amount?: number | null;
  effective_amount?: number | string;
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
  /** Fonds d'où sort l'argent (TontineType id), null = trésorerie générale.
   *  Choisi par le bureau à l'approbation, lecture seule ensuite. */
  source_fund?: string | null;
  source_fund_name?: string | null;
  requester_decision?: 'none' | 'accepted' | 'declined';
  requester_decided_at?: string | null;
  counter_offer_note?: string;
  guarantor_acceptances?: LoanGuarantorAcceptance[];
  created_at: string;
}

export interface LoanCoverage {
  expected_payouts: string;
  committed_as_guarantor: string;
  available_coverage: string;
}

export interface MyGuaranteeItem {
  acceptance_id: string;
  acceptance_status: 'pending' | 'accepted' | 'declined';
  decided_at?: string | null;
  loan: Loan;
}

/** Ventilation par source (transaction_type) : cotisations, sanctions, prêts… */
export interface FundSource {
  type: string;
  label: string;
  credit: number | string;
  debit: number | string;
  net: number | string;
}

export interface TontineBalances {
  funds: Array<{
    tontine_type_id: string;
    name: string;
    slug: string;
    currency: string;
    credits: number | string;
    debits: number | string;
    balance: number | string;
    by_source?: FundSource[];
  }>;
  unassigned: { name: string; balance: number | string; by_source?: FundSource[] };
  by_source_global?: FundSource[];
  total: number | string;
}

/** Poids d'apport des membres dans un fonds (base du partage des intérêts). */
export interface FundWeights {
  fund: { id: string; name: string };
  session: string | null;
  total: string;
  members: Array<{
    membership: string;
    member_name: string;
    contributed: string;
    weight_pct: string;
  }>;
}

// ---------- Remboursements ----------
export type LoanRepaymentStatus = 'submitted' | 'paid' | 'rejected';

export interface LoanRepayment {
  id: string;
  loan: string;
  session?: string | null;
  amount: number | string;
  paid_at?: string | null;
  payment_method?: string;
  notes?: string;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
  // ── Workflow soumission → validation ──
  status?: LoanRepaymentStatus;
  submitted_justification?: string | null;
  submitted_at?: string | null;
  validated_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string;
  borrower_name?: string;
}

// ---------- Retraits de trésorerie ----------
export type TreasuryWithdrawalStatus = 'pending' | 'applied' | 'rejected' | 'cancelled';

/**
 * Retrait sur un fonds (dépense décidée par le bureau). Créé en `pending`,
 * l'argent ne bouge qu'à l'application via le moteur d'approbations
 * (action `treasury.withdraw`, double validation). Si remboursable, la
 * dette est répartie à parts égales entre les membres actifs.
 */
export interface TreasuryWithdrawal {
  id: string;
  /** Fonds débité (TontineType id), null = fonds général / non affecté. */
  source_fund: string | null;
  source_fund_name?: string | null;
  amount: number | string;
  reason: string;
  session?: string | null;
  is_repayable: boolean;
  status: TreasuryWithdrawalStatus;
  created_by?: string | null;
  created_by_name?: string | null;
  applied_by?: string | null;
  applied_at?: string | null;
  transaction?: string | null;
  created_at: string;
}

/** Part due par un membre sur un retrait remboursable. */
export interface WithdrawalDebt {
  membership: string;
  member_name: string;
  share: number | string;
  repaid: number | string;
  outstanding: number | string;
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
