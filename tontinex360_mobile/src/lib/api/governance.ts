// Ported from web front (src/lib/api/governance.ts) — member-facing subset.
import api, { unwrap, Paginated } from './client';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_display?: string;
  audience: 'all' | 'bureau' | 'active';
  is_pinned: boolean;
  is_published: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  attachment?: string | null;
  author_name?: string | null;
  is_read?: boolean;
  created_at: string;
}

export type PollKind = 'single_choice' | 'multi_choice';
export type PollStatus = 'draft' | 'open' | 'closed' | 'cancelled';

export interface PollOption {
  id: string;
  label: string;
  display_order: number;
  votes_count: number;
}

export interface Poll {
  id: string;
  title: string;
  question: string;
  kind: PollKind;
  kind_display?: string;
  status: PollStatus;
  status_display: string;
  is_anonymous: boolean;
  allow_change_vote: boolean;
  max_choices?: number | null;
  results_visible_before_close: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_by_name?: string | null;
  options: PollOption[];
  has_voted: boolean;
  is_open_now: boolean;
  total_votes: number | null;
  created_at: string;
}

export interface PollResultOption {
  id: string;
  label: string;
  votes_count: number | null;
  percentage: number;
}

export interface PollResults {
  poll_id: string;
  total_votes: number | null;
  visible: boolean;
  options: PollResultOption[];
}

export interface GovernanceDocument {
  id: string;
  doc_type: 'charter' | 'bylaws' | 'internal_rules' | 'amendment' | 'other';
  title: string;
  content: string;
  version: string;
  is_active: boolean;
  effective_date?: string | null;
  file?: string | null;
  approved_by?: string | null;
}

export interface Election {
  id: string;
  cycle: string;
  session?: string | null;
  title: string;
  method: 'secret' | 'open' | 'consensus' | 'designation' | 'other';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  date?: string;
  notes?: string;
}

export interface ElectionCandidate {
  id: string;
  election: string;
  membership: string;
  member_name?: string;
  position: string;
  position_name?: string;
  votes_count: number;
  is_elected: boolean;
}

export const governanceApi = {
  announcements: (params?: { priority?: string; audience?: string; active_only?: string }) =>
    api
      .get<Announcement[] | Paginated<Announcement>>('/governance/announcements/', { params })
      .then((r) => unwrap(r.data)),

  getAnnouncement: (id: string) =>
    api.get<Announcement>(`/governance/announcements/${id}/`).then((r) => r.data),

  announcementsUnreadCount: () =>
    api
      .get<{ count: number }>('/governance/announcements/unread_count/')
      .then((r) => r.data.count),

  markAnnouncementRead: (id: string) =>
    api.post(`/governance/announcements/${id}/mark_read/`).then((r) => r.data),

  polls: (params?: { status?: string; kind?: string }) =>
    api.get<Poll[] | Paginated<Poll>>('/governance/polls/', { params }).then((r) => unwrap(r.data)),

  getPoll: (id: string) => api.get<Poll>(`/governance/polls/${id}/`).then((r) => r.data),

  pollResults: (id: string) =>
    api.get<PollResults>(`/governance/polls/${id}/results/`).then((r) => r.data),

  votePoll: (id: string, optionIds: string[]) =>
    api.post<Poll>(`/governance/polls/${id}/vote/`, { option_ids: optionIds }).then((r) => r.data),

  // ---------- Bureau : sondages ----------
  createPoll: (
    data: Partial<Poll> & { options_input?: { label: string; display_order?: number }[] },
  ) => api.post<Poll>('/governance/polls/', data).then((r) => r.data),
  openPoll: (id: string) => api.post<Poll>(`/governance/polls/${id}/open/`).then((r) => r.data),
  closePoll: (id: string) => api.post<Poll>(`/governance/polls/${id}/close/`).then((r) => r.data),

  // ---------- Bureau : annonces ----------
  createAnnouncement: (data: Partial<Announcement> | FormData) =>
    api.post<Announcement>('/governance/announcements/', data).then((r) => r.data),
  updateAnnouncement: (id: string, data: Partial<Announcement>) =>
    api.patch<Announcement>(`/governance/announcements/${id}/`, data).then((r) => r.data),
  removeAnnouncement: (id: string) =>
    api.delete(`/governance/announcements/${id}/`).then((r) => r.data),

  // ---------- Bureau : documents ----------
  documents: (params?: { doc_type?: string; is_active?: boolean }) =>
    api
      .get<GovernanceDocument[] | Paginated<GovernanceDocument>>('/governance/documents/', { params })
      .then((r) => unwrap(r.data)),
  getDocument: (id: string) =>
    api.get<GovernanceDocument>(`/governance/documents/${id}/`).then((r) => r.data),
  createDocument: (data: Partial<GovernanceDocument> | FormData) =>
    api.post<GovernanceDocument>('/governance/documents/', data).then((r) => r.data),
  updateDocument: (id: string, data: Partial<GovernanceDocument>) =>
    api.patch<GovernanceDocument>(`/governance/documents/${id}/`, data).then((r) => r.data),
  removeDocument: (id: string) =>
    api.delete(`/governance/documents/${id}/`).then((r) => r.data),

  // ---------- Bureau : élections ----------
  elections: (params?: { cycle?: string; status?: string }) =>
    api
      .get<Election[] | Paginated<Election>>('/governance/elections/', { params })
      .then((r) => unwrap(r.data)),
  getElection: (id: string) =>
    api.get<Election>(`/governance/elections/${id}/`).then((r) => r.data),
  createElection: (data: Partial<Election>) =>
    api.post<Election>('/governance/elections/', data).then((r) => r.data),
  updateElection: (id: string, data: Partial<Election>) =>
    api.patch<Election>(`/governance/elections/${id}/`, data).then((r) => r.data),
  removeElection: (id: string) =>
    api.delete(`/governance/elections/${id}/`).then((r) => r.data),
  candidates: (electionId?: string) =>
    api
      .get<ElectionCandidate[] | Paginated<ElectionCandidate>>('/governance/candidates/', {
        params: electionId ? { election: electionId } : undefined,
      })
      .then((r) => unwrap(r.data)),
  addCandidate: (data: { election: string; membership: string; position: string }) =>
    api.post<ElectionCandidate>('/governance/candidates/', data).then((r) => r.data),
  removeCandidate: (id: string) =>
    api.delete(`/governance/candidates/${id}/`).then((r) => r.data),
};
