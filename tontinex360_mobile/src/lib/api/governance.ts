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
};
