import api from './client';
import type { SessionPot, BeneficiaryPayout, AuctionBid } from '@/lib/types/pot';

export const potsApi = {
  list: (params?: { session?: string; tontine_type?: string; is_closed?: boolean }) =>
    api.get<SessionPot[]>('/cycles/pots/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<SessionPot>(`/cycles/pots/${id}/`).then(r => r.data),

  openPot: (sessionId: string, data: {
    tontine_type_id: string;
    override_method?: string;
    override_reason?: string;
  }) => api.post<SessionPot>(
    `/cycles/sessions/${sessionId}/open-pot/`, data,
  ).then(r => r.data),

  distribute: (potId: string, data: {
    membership_id: string;
    shares_claimed?: number | null;
    proxy_id?: string | null;
  }) => api.post<BeneficiaryPayout>(
    `/cycles/pots/${potId}/distribute/`, data,
  ).then(r => r.data),

  processAuction: (potId: string, data: {
    winner_membership_id: string;
    bid_amount: number | string;
    proxy_id?: string | null;
  }) => api.post<BeneficiaryPayout>(
    `/cycles/pots/${potId}/auction/`, data,
  ).then(r => r.data),

  closePot: (potId: string) =>
    api.post<{
      remainder: string;
      message: string;
      wallet_distribution: any;
    }>(`/cycles/pots/${potId}/close/`).then(r => r.data),

  payouts: (params?: Record<string, string>) =>
    api.get<BeneficiaryPayout[]>('/cycles/payouts/', { params }).then(r => r.data),

  /**
   * Signe le bordereau de réception d'un versement et génère le PDF.
   * `signature` est un data-URL PNG : "data:image/png;base64,..."
   */
  signReceipt: (payoutId: string, signature: string, deviceInfo?: Record<string, any>) =>
    api.post<BeneficiaryPayout>(`/cycles/payouts/${payoutId}/sign_receipt/`, {
      signature,
      device_info: deviceInfo ?? {},
    }).then(r => r.data),

  bids: (potId: string) =>
    api.get<AuctionBid[]>('/cycles/bids/', { params: { pot: potId } }).then(r => r.data),
  placeBid: (data: { pot: string; membership: string; bid_amount: number | string }) =>
    api.post<AuctionBid>('/cycles/bids/', data).then(r => r.data),
};
