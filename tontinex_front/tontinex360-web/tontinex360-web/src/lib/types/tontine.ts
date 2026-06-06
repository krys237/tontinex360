export type TontineRateMode = 'fixed' | 'range' | 'free';
export type ContributionKind = 'cash' | 'in_kind';

export interface TontineType {
  id: string;
  name: string;
  slug: string;
  description: string;

  // Mode de cotisation : argent ou en nature
  contribution_kind: ContributionKind;
  contribution_kind_display?: string;
  in_kind_unit_label?: string;        // ex: "Sac de riz 25kg"
  in_kind_unit_value?: number | null; // valeur XAF de référence

  // Taux
  rate_mode: TontineRateMode;
  fixed_rate?: number | null;
  min_rate?: number | null;
  max_rate?: number | null;
  currency: string;

  // Parts
  allows_multiple_shares: boolean;
  max_shares_per_member: number;
  share_unit_name: string;

  has_beneficiary: boolean;
  is_active: boolean;
  display_order: number;

  default_account?: string | null;
  default_account_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MemberSubscription {
  id: string;
  membership: string;
  tontine_type: string;
  cycle: string;
  num_shares: number;
  rate_per_share: number;
  is_active: boolean;
}
