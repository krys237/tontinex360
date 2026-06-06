import api from './client';

export type ContributionKind = 'cash' | 'in_kind';

export type PayoutPattern =
  | 'rotating'
  | 'individual_savings'
  | 'collective_savings';

export type AcquisitionMethod =
  | 'random'
  | 'sequential'
  | 'auction'
  | 'vote'
  | 'need_based'
  | 'manual';

export interface TontineType {
  id: string;
  name: string;
  slug: string;
  description: string;
  // Mode de cotisation
  contribution_kind?: ContributionKind;
  contribution_kind_display?: string;
  in_kind_unit_label?: string;        // ex: "Sac de riz 25kg"
  in_kind_unit_value?: number | string | null;
  // Taux
  rate_mode: 'fixed' | 'range' | 'free';
  fixed_rate?: number | string | null;
  min_rate?: number | string | null;
  max_rate?: number | string | null;
  currency: string;
  allows_multiple_shares: boolean;
  max_shares_per_member?: number | null;
  share_unit_name: string;
  has_beneficiary: boolean;
  // Pattern de restitution et méthode d'attribution par défaut
  payout_pattern?: PayoutPattern;
  payout_pattern_display?: string;
  default_acquisition_method?: AcquisitionMethod;
  default_acquisition_method_display?: string;
  is_active: boolean;
  display_order: number;
  default_account?: string | null;
  default_account_name?: string | null;
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

export const tontinesApi = {
  // Types
  types: (params?: { is_active?: boolean }) =>
    api.get<TontineType[]>('/tontines/types/', { params }).then(r => r.data),
  getType: (id: string) =>
    api.get<TontineType>(`/tontines/types/${id}/`).then(r => r.data),
  createType: (data: Partial<TontineType>) =>
    api.post<TontineType>('/tontines/types/', data).then(r => r.data),
  updateType: (id: string, data: Partial<TontineType>) =>
    api.patch<TontineType>(`/tontines/types/${id}/`, data).then(r => r.data),
  removeType: (id: string) =>
    api.delete(`/tontines/types/${id}/`).then(r => r.data),

  // Souscriptions
  subscriptions: (params?: { cycle?: string; tontine_type?: string }) =>
    api.get<MemberSubscription[]>('/tontines/subscriptions/', { params }).then(r => r.data),
  createSubscription: (data: Partial<MemberSubscription>) =>
    api.post<MemberSubscription>('/tontines/subscriptions/', data).then(r => r.data),
  updateSubscription: (id: string, data: Partial<MemberSubscription>) =>
    api.patch<MemberSubscription>(`/tontines/subscriptions/${id}/`, data).then(r => r.data),
  removeSubscription: (id: string) =>
    api.delete(`/tontines/subscriptions/${id}/`).then(r => r.data),
};
