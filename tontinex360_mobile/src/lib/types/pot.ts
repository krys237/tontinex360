// Ported from web front (src/lib/types/pot.ts).
export type AcquisitionMethod =
  | 'random'
  | 'sequential'
  | 'auction'
  | 'vote'
  | 'need_based'
  | 'manual';
export type PayoutStatus = 'pending' | 'paid' | 'cancelled';

export interface BeneficiaryPayout {
  id: string;
  pot: string;
  membership: string;
  member_name: string;
  tontine_name: string;
  session_number: number;
  shares_claimed: number;
  shares_total: number;
  amount: number;
  acquisition_method: AcquisitionMethod;
  method_display: string;
  schedule_order?: number;
  status: PayoutStatus;
  paid_at?: string;
  notes: string;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
  is_in_kind?: boolean;
}

export interface SessionPot {
  id: string;
  session: string;
  tontine_type: string;
  tontine_name: string;
  total_collected: number | string;
  carry_over_in: number | string;
  auction_premium_in: number | string;
  total_available: number | string;
  total_distributed: number | string;
  remainder: number | string;
  effective_method: AcquisitionMethod;
  method_display: string;
  is_method_overridden: boolean;
  override_reason: string;
  is_closed: boolean;
  payouts: BeneficiaryPayout[];
  created_at: string;
}

// Lots distribuables calculés pour une séance, par type de tontine.
export interface SessionLotCandidate {
  membership_id: string;
  member_name: string;
  num_shares: number;
  paid_shares: number;
  remaining_shares: number;
  computed_lot: string;
  full_lot: string;
  is_servable_full: boolean;
  is_eligible: boolean;
  already_paid: boolean;
}

export interface SessionLotsForType {
  tontine_type_id: string;
  tontine_type_name: string;
  nb_sessions_cycle: number;
  value_per_share: string;
  lot_per_share: string;
  pot_available: string;
  pot_distributed: string;
  pot_remaining: string;
  max_shares_servable: number;
  candidates: SessionLotCandidate[];
}
