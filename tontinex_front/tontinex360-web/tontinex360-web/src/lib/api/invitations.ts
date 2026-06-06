import api from './client';

export interface Invitation {
  id: string;
  invited_by: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  token: string;
  role?: string | null;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  channel: 'email' | 'sms' | 'whatsapp' | 'link';
  expires_at?: string | null;
  accepted_at?: string | null;
  resulting_membership?: string | null;
  created_at: string;
}

export const invitationsApi = {
  list: (params?: { status?: string; channel?: string }) =>
    api.get<Invitation[]>('/invitations/list/', { params }).then(r => r.data),

  check: (token: string) =>
    api.get(`/invitations/check/${token}/`).then(r => r.data),

  send: (data: {
    email?: string; phone?: string; name?: string;
    role?: string; channel?: 'email' | 'sms' | 'whatsapp' | 'link';
    message?: string;
    auto_mark_fees_paid?: boolean;
  }) => api.post<Invitation>('/invitations/send/', data).then(r => r.data),

  accept: (token: string) =>
    api.post('/invitations/accept/', { token }).then(r => r.data),

  registerAccept: (data: {
    token: string; telephone: string;
    first_name: string; last_name: string;
    email?: string; password: string; password_confirm: string;
  }) => api.post('/invitations/register-and-accept/', data).then(r => r.data),

  loginAccept: (data: { token: string; telephone: string; password: string }) =>
    api.post('/invitations/login-and-accept/', data).then(r => r.data),
};
