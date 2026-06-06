// Ported from the web front (src/lib/api/auth.ts) — same endpoints & payloads.
import api from './client';
import type {
  User,
  TokenPair,
  LoginRequest,
  RegisterRequest,
  Association,
} from '../types/auth';

export const authApi = {
  // --- Auth ---
  login: (data: LoginRequest) =>
    api.post<{ user: User; tokens: TokenPair }>('/auth/login/', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    api.post<{ user: User; tokens: TokenPair }>('/auth/register/', data).then((r) => r.data),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/token/refresh/', { refresh }).then((r) => r.data),

  validateOtp: (data: { telephone: string; otp: string }) =>
    api.post('/auth/valid-otp/', data).then((r) => r.data),

  resendOtp: (
    telephone: string,
    opts?: { channel?: 'whatsapp' | 'sms' | 'email'; email?: string },
  ) =>
    api
      .post('/auth/resend-otp/', {
        telephone,
        ...(opts?.channel ? { channel: opts.channel } : {}),
        ...(opts?.email ? { email: opts.email } : {}),
      })
      .then((r) => r.data),

  // Note: backend route really is "change-fogot-password" (typo kept on purpose).
  forgotPassword: (data: { telephone: string; password: string }) =>
    api.post('/auth/change-fogot-password/', data).then((r) => r.data),

  changePassword: (data: { telephone: string; old_password: string; new_password: string }) =>
    api.post('/auth/change-password/', data).then((r) => r.data),

  // --- Profile ---
  me: () => api.get<User>('/auth/me/').then((r) => r.data),

  updateMe: (data: Partial<User>) =>
    api.patch<User>('/auth/me/', data).then((r) => r.data),

  registerFcmToken: (data: { token: string; device_type: 'android' | 'ios' | 'web' }) =>
    api.post('/auth/register-fcm-token/', data).then((r) => r.data),

  // --- Associations (mounted on both /auth/ and /associations/ — we use /associations/) ---
  myAssociations: () =>
    api
      .get<{ associations: Association[]; active_slug?: string | null }>(
        '/associations/associations/',
      )
      .then((r) => r.data),

  selectAssociation: (slug: string) =>
    api
      .post<{ active_association: Association }>('/associations/associations/select/', { slug })
      .then((r) => r.data),

  createAssociation: (data: {
    name: string;
    slug: string;
    description?: string;
    city?: string;
    region?: string;
  }) =>
    api
      .post<{
        association: Association;
        membership_id: string;
        subscription_status: string;
        trial_end: string | null;
      }>('/associations/associations/create/', data)
      .then((r) => r.data),

  getAssociation: (slug: string) =>
    api.get<Association>(`/associations/associations/${slug}/`).then((r) => r.data),

  updateAssociation: (slug: string, data: Partial<Association> | FormData) =>
    api.patch<Association>(`/associations/associations/${slug}/`, data).then((r) => r.data),
};
