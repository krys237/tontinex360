// Invitations bureau — porté du web front (src/lib/api/invitations.ts).
import api, { unwrap, Paginated } from './client';
import type { Invitation, InvitationChannel } from '../types/invitation';

/** Réponse de la vérification publique d'un token d'invitation. */
export interface InvitationCheck {
  invitation: {
    token: string;
    association_name: string;
    association_logo?: string | null;
    invited_by: string;
    role_name: string;
    message?: string;
    expires_at?: string | null;
  };
  has_existing_account: boolean;
  existing_telephone?: string | null;
}

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

  /** Vérifie un token d'invitation (public) : asso, invitant, rôle, validité. */
  check: (token: string) =>
    api.get<InvitationCheck>(`/invitations/check/${encodeURIComponent(token)}/`).then((r) => r.data),

  /** Accepte une invitation pour l'utilisateur CONNECTÉ (crée l'adhésion). */
  accept: (token: string) =>
    api
      .post<{ message: string; association: unknown; membership_id: string }>('/invitations/accept/', { token })
      .then((r) => r.data),
};
