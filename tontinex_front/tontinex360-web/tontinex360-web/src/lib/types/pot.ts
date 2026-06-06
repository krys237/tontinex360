export type AcquisitionMethod = 'random' | 'sequential' | 'auction' | 'vote' | 'need_based' | 'manual';
export type PayoutStatus = 'pending' | 'paid' | 'cancelled';

export interface SessionPot {
  id: string;
  session: string;
  tontine_type: string;
  tontine_name: string;
  total_collected: number;
  carry_over_in: number;
  auction_premium_in: number;
  total_available: number;
  total_distributed: number;
  remainder: number;
  effective_method: AcquisitionMethod;
  method_display: string;
  is_method_overridden: boolean;
  override_reason: string;
  is_closed: boolean;
  payouts: BeneficiaryPayout[];
  created_at: string;
}

export interface BeneficiaryPayout {
  id: string;
  pot: string;
  membership: string;
  member_name: string;
  tontine_name: string;
  session_number: number;
  shares_claimed: number;
  shares_total: number;
  amount: number;                         // En XAF équivalent si in_kind
  acquisition_method: AcquisitionMethod;
  method_display: string;
  schedule_order?: number;
  status: PayoutStatus;
  paid_at?: string;
  notes: string;
  // Bordereau de réception
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
  // Versement en nature
  is_in_kind?: boolean;
  in_kind_quantity?: number | null;
  in_kind_unit_label?: string;
  was_converted_to_cash?: boolean;
  // Hérité du TontineType (lecture seule)
  tontine_contribution_kind?: 'cash' | 'in_kind';
  tontine_in_kind_unit_label?: string;
}

export interface AuctionBid {
  id: string;
  pot: string;
  membership: string;
  member_name: string;
  bid_amount: number;
  status: 'active' | 'won' | 'lost' | 'cancelled';
  resulting_payout?: string;
  created_at: string;
}
