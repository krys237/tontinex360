// Minimal members API needed by Phase 0 to resolve the current membership (roles -> permissions).
// The full members module is built in Phase 2.
import api, { unwrap, Paginated } from './client';
import type { Membership, MembershipListItem } from '../types/member';

export const membersApi = {
  list: (params?: { search?: string; status?: string }) =>
    api
      .get<MembershipListItem[] | Paginated<MembershipListItem>>('/members/memberships/', { params })
      .then((r) => unwrap(r.data)),

  get: (id: string) =>
    api.get<Membership>(`/members/memberships/${id}/`).then((r) => r.data),
};
