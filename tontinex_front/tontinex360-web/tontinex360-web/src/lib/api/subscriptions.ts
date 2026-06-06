import api from './client';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number | string;
  price_yearly: number | string;
  currency: string;
  max_members: number;
  max_tontine_types: number;
  max_cycles: number;
  features: string[];
  trial_days: number;
  is_active: boolean;
  display_order: number;
}

export interface Subscription {
  id: string;
  association: string;
  plan: Plan | string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'suspended';
  billing_cycle: 'monthly' | 'yearly';
  trial_start?: string | null;
  trial_end?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  auto_renew: boolean;
  cancelled_at?: string | null;
}

export interface Payment {
  id: string;
  subscription: string;
  amount: number | string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  provider_reference?: string;
  description?: string;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at: string;
}

export const subscriptionsApi = {
  plans: () => api.get<Plan[]>('/subscriptions/plans/').then(r => r.data),
  mySubscription: () =>
    api.get<Subscription>('/subscriptions/my-subscription/').then(r => r.data),
  payments: () =>
    api.get<Payment[]>('/subscriptions/payments/').then(r => r.data),
};
