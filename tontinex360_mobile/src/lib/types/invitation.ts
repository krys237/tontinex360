// Ported from the web front (src/lib/api/invitations.ts).

export type InvitationChannel = 'email' | 'sms' | 'whatsapp' | 'link';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  invited_by: string;
  invited_by_name?: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  token: string;
  role?: string | null;
  message?: string;
  status: InvitationStatus;
  channel: InvitationChannel;
  expires_at?: string | null;
  accepted_at?: string | null;
  resulting_membership?: string | null;
  invite_url?: string;
  auto_mark_fees_paid?: boolean;
  last_resent_at?: string | null;
  resend_count?: number;
  /** True si expires_at est dépassée (calculé côté backend). */
  is_expired?: boolean;
  created_at: string;
}
