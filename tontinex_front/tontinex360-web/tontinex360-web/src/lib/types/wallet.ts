export type WalletEntryDirection = 'credit' | 'debit';
export type WalletEntrySource =
  | 'auction_premium'
  | 'loan_interest'
  | 'sanction_payment'
  | 'contribution_default'
  | 'default_compensation'
  | 'expense'
  | 'manual_adjustment';

export interface Wallet {
  id: string;
  membership: string;
  member_name: string;
  member_number?: string;
  balance: number | string;
  total_credits: number | string;
  total_debits: number | string;
  is_frozen: boolean;
  last_entry_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WalletEntry {
  id: string;
  direction: WalletEntryDirection;
  direction_display?: string;
  amount: number | string;
  signed_amount?: number | string;
  source_type: WalletEntrySource;
  source_type_display?: string;
  source_id?: string | null;
  session?: string | null;
  session_number?: number | null;
  session_date?: string | null;
  cycle?: string | null;
  distribution_batch?: string | null;
  total_distributed: number | string;
  members_count: number;
  per_member_amount: number | string;
  description: string;
  balance_after: number | string;
  created_at: string;
}

export interface WalletSummary {
  wallet: Wallet;
  cycle?: string | null;
  credits_total: number | string;
  debits_total: number | string;
  net: number | string;
  breakdown: Array<{
    source_type: WalletEntrySource;
    direction: WalletEntryDirection;
    total: number | string;
  }>;
}

export interface CycleSettlementRow {
  wallet_id: string;
  membership_id: string;
  member_name: string;
  credits: number | string;
  debits: number | string;
  net: number | string;
  direction: 'pay_to_member' | 'owed_by_member' | 'balanced';
}

export interface CycleSettlement {
  cycle_id: string;
  cycle_name: string;
  rows: CycleSettlementRow[];
  totals: {
    credits: number | string;
    debits: number | string;
    net: number | string;
  };
}
