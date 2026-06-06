import api, { unwrap, type Paginated } from './client';
import type {
  Membership, MembershipListItem,
  Role, BureauPosition, BureauMember,
  MembershipRequest, Resignation,
} from '@/lib/types/member';

type MaybePaginated<T> = T[] | Paginated<T>;

export const membersApi = {
  // ---------- Memberships ----------
  list: (params?: Record<string, string>) =>
    api.get<MaybePaginated<MembershipListItem>>('/members/memberships/', { params })
      .then(r => unwrap(r.data)),
  get: (id: string) =>
    api.get<Membership>(`/members/memberships/${id}/`).then(r => r.data),
  create: (data: Partial<Membership> & { user: string }) =>
    api.post<Membership>('/members/memberships/', data).then(r => r.data),
  update: (id: string, data: Partial<Membership>) =>
    api.patch<Membership>(`/members/memberships/${id}/`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/members/memberships/${id}/`).then(r => r.data),

  /**
   * Enregistre la signature de référence d'un membre.
   * `signature` est un data-URL PNG : "data:image/png;base64,..."
   */
  setSignature: (id: string, signature: string) =>
    api.post<Membership>(`/members/memberships/${id}/signature/`, { signature })
      .then(r => r.data),

  // ---------- Roles ----------
  roles: () => api.get<MaybePaginated<Role>>('/members/roles/').then(r => unwrap(r.data)),
  getRole: (id: string) =>
    api.get<Role>(`/members/roles/${id}/`).then(r => r.data),
  createRole: (data: Partial<Role>) =>
    api.post<Role>('/members/roles/', data).then(r => r.data),
  updateRole: (id: string, data: Partial<Role>) =>
    api.patch<Role>(`/members/roles/${id}/`, data).then(r => r.data),
  removeRole: (id: string) =>
    api.delete(`/members/roles/${id}/`).then(r => r.data),

  // ---------- Bureau Positions ----------
  bureauPositions: () =>
    api.get<MaybePaginated<BureauPosition>>('/members/bureau-positions/').then(r => unwrap(r.data)),
  createBureauPosition: (data: Partial<BureauPosition>) =>
    api.post<BureauPosition>('/members/bureau-positions/', data).then(r => r.data),
  updateBureauPosition: (id: string, data: Partial<BureauPosition>) =>
    api.patch<BureauPosition>(`/members/bureau-positions/${id}/`, data).then(r => r.data),
  removeBureauPosition: (id: string) =>
    api.delete(`/members/bureau-positions/${id}/`).then(r => r.data),

  // ---------- Bureau Members ----------
  bureauMembers: (params?: { cycle?: string; is_active?: boolean }) =>
    api.get<MaybePaginated<BureauMember>>('/members/bureau-members/', { params })
      .then(r => unwrap(r.data)),
  assignBureauMember: (data: {
    membership: string; position: string; cycle?: string;
    start_date: string; end_date?: string; designation_method?: string;
  }) => api.post<BureauMember>('/members/bureau-members/', data).then(r => r.data),
  updateBureauMember: (id: string, data: Partial<BureauMember>) =>
    api.patch(`/members/bureau-members/${id}/`, data).then(r => r.data),
  removeBureauMember: (id: string) =>
    api.delete(`/members/bureau-members/${id}/`).then(r => r.data),

  // ---------- Membership Requests ----------
  membershipRequests: (params?: { status?: string }) =>
    api.get<MaybePaginated<MembershipRequest>>('/members/membership-requests/', { params })
      .then(r => unwrap(r.data)),
  getMembershipRequest: (id: string) =>
    api.get<MembershipRequest>(`/members/membership-requests/${id}/`).then(r => r.data),
  createMembershipRequest: (data: {
    cycle?: string | null; motivation?: string;
    contact_phone?: string; contact_email?: string;
  }) => api.post<MembershipRequest>('/members/membership-requests/', data).then(r => r.data),
  approveMembershipRequest: (id: string, review_note = '') =>
    api.post<MembershipRequest>(`/members/membership-requests/${id}/approve/`, { review_note })
      .then(r => r.data),
  rejectMembershipRequest: (id: string, review_note = '') =>
    api.post<MembershipRequest>(`/members/membership-requests/${id}/reject/`, { review_note })
      .then(r => r.data),
  cancelMembershipRequest: (id: string) =>
    api.post<MembershipRequest>(`/members/membership-requests/${id}/cancel/`).then(r => r.data),

  // ---------- Resignations ----------
  resignations: () =>
    api.get<MaybePaginated<Resignation>>('/members/resignations/').then(r => unwrap(r.data)),
  getResignation: (id: string) =>
    api.get<Resignation>(`/members/resignations/${id}/`).then(r => r.data),
  createResignation: (data: { reason: string; effective_date?: string | null }) =>
    api.post<Resignation>('/members/resignations/', data).then(r => r.data),
  approveResignation: (id: string, data: { review_note?: string; effective_date?: string }) =>
    api.post<Resignation>(`/members/resignations/${id}/approve/`, data).then(r => r.data),
  rejectResignation: (id: string, review_note = '') =>
    api.post<Resignation>(`/members/resignations/${id}/reject/`, { review_note }).then(r => r.data),
  cancelResignation: (id: string) =>
    api.post<Resignation>(`/members/resignations/${id}/cancel/`).then(r => r.data),
};
