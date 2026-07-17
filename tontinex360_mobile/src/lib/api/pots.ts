// Pots / distributions / enchères (bureau) — porté du web front (src/lib/api/pots.ts).
import api, { unwrap, Paginated } from './client';
import type { SessionPot, BeneficiaryPayout } from '../types/pot';
import type { AuctionBid } from '../types/cycle';

export const potsApi = {
  list: (params?: { session?: string; tontine_type?: string; is_closed?: boolean }) =>
    api.get<SessionPot[] | Paginated<SessionPot>>('/cycles/pots/', { params }).then((r) => unwrap(r.data)),
  get: (id: string) => api.get<SessionPot>(`/cycles/pots/${id}/`).then((r) => r.data),

  openPot: (
    sessionId: string,
    data: { tontine_type_id: string; override_method?: string; override_reason?: string },
  ) => api.post<SessionPot>(`/cycles/sessions/${sessionId}/open-pot/`, data).then((r) => r.data),

  distribute: (
    potId: string,
    data: { membership_id: string; shares_claimed?: number | null; proxy_id?: string | null },
  ) => api.post<BeneficiaryPayout>(`/cycles/pots/${potId}/distribute/`, data).then((r) => r.data),

  processAuction: (
    potId: string,
    data: { winner_membership_id: string; bid_amount: number | string; proxy_id?: string | null },
  ) => api.post<BeneficiaryPayout>(`/cycles/pots/${potId}/auction/`, data).then((r) => r.data),

  closePot: (potId: string) =>
    api
      .post<{ remainder: string; message: string; wallet_distribution: any }>(
        `/cycles/pots/${potId}/close/`,
      )
      .then((r) => r.data),

  // ---------- Distributions (payouts) ----------
  payouts: (params?: Record<string, string>) =>
    api
      .get<BeneficiaryPayout[] | Paginated<BeneficiaryPayout>>('/cycles/payouts/', { params })
      .then((r) => unwrap(r.data)),
  getPayout: (id: string) =>
    api.get<BeneficiaryPayout>(`/cycles/payouts/${id}/`).then((r) => r.data),
  signReceipt: (payoutId: string, signature: string, deviceInfo?: Record<string, any>) =>
    api
      .post<BeneficiaryPayout>(`/cycles/payouts/${payoutId}/sign_receipt/`, {
        signature,
        device_info: deviceInfo ?? {},
      })
      .then((r) => r.data),

  // ---------- Enchères ----------
  bids: (potId: string) =>
    api
      .get<AuctionBid[] | Paginated<AuctionBid>>('/cycles/bids/', { params: { pot: potId } })
      .then((r) => unwrap(r.data)),

  /** Le membre place une enchère. Refusé backend si enchères pas ouvertes ou
   *  shares_requested > shares_offered. */
  placeBid: (data: {
    pot: string;
    membership: string;
    bid_amount: number | string;
    shares_requested?: number | string;
  }) => api.post<AuctionBid>('/cycles/bids/', data).then((r) => r.data),

  /** Le bureau ouvre les enchères d'un pot en mettant N noms en jeu. */
  startBidding: (potId: string, sharesOffered: number | string = 1) =>
    api
      .post<SessionPot>(`/cycles/pots/${potId}/start-bidding/`, { shares_offered: sharesOffered })
      .then((r) => r.data),
};
