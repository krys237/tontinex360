// Invitations bureau — porté du web front (src/lib/api/invitations.ts).
import api, { unwrap, Paginated } from './client';
import type { Invitation, InvitationChannel } from '../types/invitation';

export const invitationsApi = {
  list: (params?: { status?: string; channel?: string }) =>
    api
      .get<Invitation[] | Paginated<Invitation>>('/invitations/list/', { params })
      .then((r) => unwrap(r.data)),

  get: (id: string) =>
    api.get<Invitation>(`/invitations/list/${id}/`).then((r) => r.data),

  send: (data: {
    email?: string;
    phone?: string;
    name?: string;
    role?: string;
    channel?: InvitationChannel;
    message?: string;
    auto_mark_fees_paid?: boolean;
  }) => api.post<Invitation>('/invitations/send/', data).then((r) => r.data),

  /**
   * Relance une invitation existante (renvoi du lien, ou régénération si expirée).
   * Le canal peut changer à la relance (ex : email → WhatsApp).
   */
  resend: (
    id: string,
    data?: { channel?: InvitationChannel; email?: string; phone?: string },
  ) => api.post<Invitation>(`/invitations/${id}/resend/`, data ?? {}).then((r) => r.data),

  /** Annule (révoque) une invitation envoyée. Le lien devient invalide. */
  cancel: (id: string) =>
    api.post<Invitation>(`/invitations/${id}/cancel/`).then((r) => r.data),
};
