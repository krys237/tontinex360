// Ported from web front (src/lib/api/tontines.ts types).
export type ContributionKind = 'cash' | 'in_kind';
export type TontineRateMode = 'fixed' | 'range' | 'free';
export type PayoutPattern = 'rotating' | 'individual_savings' | 'collective_savings';
export type AcquisitionMethod =
  | 'random' | 'sequential' | 'auction' | 'vote' | 'need_based' | 'manual';

export interface TontineType {
  id: string;
  name: string;
  slug: string;
  description: string;
  contribution_kind?: ContributionKind;
  in_kind_unit_label?: string;
  in_kind_unit_value?: number | string | null;
  rate_mode: TontineRateMode;
  fixed_rate?: number | string | null;
  min_rate?: number | string | null;
  max_rate?: number | string | null;
  currency: string;
  allows_multiple_shares: boolean;
  max_shares_per_member?: number | null;
  share_unit_name: string;
  has_beneficiary: boolean;
  payout_pattern?: PayoutPattern;
  default_acquisition_method?: AcquisitionMethod;
  is_active: boolean;
  display_order: number;
  default_account?: string | null;
  default_account_name?: string | null;
  contribution_kind_display?: string;
  payout_pattern_display?: string;
  default_acquisition_method_display?: string;
}

export interface MemberSubscription {
  id: string;
  membership: string;
  tontine_type: string;
  cycle: string;
  num_shares: number;
  rate_per_share: number | string;
  amount_per_session?: number | string;
  is_active?: boolean;
  member_name?: string;
  tontine_name?: string;
}
