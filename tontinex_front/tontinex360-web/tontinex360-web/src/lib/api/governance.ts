import api from './client';

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
  position: string;
  votes_count: number;
  is_elected: boolean;
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
  kind_display: string;
  status: PollStatus;
  status_display: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_anonymous: boolean;
  allow_change_vote: boolean;
  max_choices?: number | null;
  results_visible_before_close: boolean;
  created_by?: string | null;
  created_by_name?: string | null;
  options: PollOption[];
  has_voted: boolean;
  is_open_now: boolean;
  total_votes: number | null;
  created_at: string;
}

export interface PollResults {
  poll_id: string;
  total_votes: number | null;
  visible: boolean;
  options: Array<{
    id: string;
    label: string;
    votes_count: number | null;
    percentage: number;
  }>;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_display?: string;
  audience: 'all' | 'bureau' | 'active';
  audience_display?: string;
  is_pinned: boolean;
  is_published: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  attachment?: string | null;
  author?: string | null;
  author_name?: string | null;
  is_read?: boolean;
  created_at: string;
  updated_at: string;
}

export const governanceApi = {
  // Documents
  documents: (params?: { doc_type?: string; is_active?: boolean }) =>
    api.get<GovernanceDocument[]>('/governance/documents/', { params }).then(r => r.data),
  getDocument: (id: string) =>
    api.get<GovernanceDocument>(`/governance/documents/${id}/`).then(r => r.data),
  createDocument: (data: Partial<GovernanceDocument> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.post<GovernanceDocument>(
      '/governance/documents/',
      data,
      // En FormData, on retire Content-Type pour qu'axios mette le boundary auto
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },
  updateDocument: (id: string, data: Partial<GovernanceDocument> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.patch<GovernanceDocument>(
      `/governance/documents/${id}/`,
      data,
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },
  removeDocument: (id: string) =>
    api.delete(`/governance/documents/${id}/`).then(r => r.data),

  // Elections
  elections: (params?: { cycle?: string; status?: string }) =>
    api.get<Election[]>('/governance/elections/', { params }).then(r => r.data),
  createElection: (data: Partial<Election>) =>
    api.post<Election>('/governance/elections/', data).then(r => r.data),

  candidates: (electionId?: string) =>
    api.get<ElectionCandidate[]>('/governance/candidates/', {
      params: electionId ? { election: electionId } : undefined,
    }).then(r => r.data),
  addCandidate: (data: { election: string; membership: string; position: string }) =>
    api.post<ElectionCandidate>('/governance/candidates/', data).then(r => r.data),

  // Votes
  vote: (data: { election: string; candidate: string; voter?: string | null }) =>
    api.post('/governance/votes/', data).then(r => r.data),

  // Polls (sondages électroniques)
  polls: (params?: { status?: string; kind?: string }) =>
    api.get<Poll[]>('/governance/polls/', { params }).then(r => r.data),
  getPoll: (id: string) =>
    api.get<Poll>(`/governance/polls/${id}/`).then(r => r.data),
  createPoll: (data: Partial<Poll> & { options_input?: { label: string; display_order?: number }[] }) =>
    api.post<Poll>('/governance/polls/', data).then(r => r.data),
  openPoll: (id: string) =>
    api.post<Poll>(`/governance/polls/${id}/open/`).then(r => r.data),
  closePoll: (id: string) =>
    api.post<Poll>(`/governance/polls/${id}/close/`).then(r => r.data),
  votePoll: (id: string, optionIds: string[]) =>
    api.post<Poll>(`/governance/polls/${id}/vote/`, { option_ids: optionIds })
      .then(r => r.data),
  pollResults: (id: string) =>
    api.get<PollResults>(`/governance/polls/${id}/results/`).then(r => r.data),

  // Saisie post-AG des résultats d'élection
  saveElectionResults: (
    electionId: string,
    results: { candidate_id: string; votes_count: number; is_elected: boolean }[],
  ) => api.post<{ election_id: string; election_status: string; updated: number; errors: any[]; next_step: string | null }>(
    '/governance/candidates/bulk-save-results/',
    { election: electionId, results },
  ).then(r => r.data),

  // Announcements
  announcements: (params?: { priority?: string; audience?: string; active_only?: boolean }) =>
    api.get<Announcement[]>('/governance/announcements/', { params }).then(r => r.data),
  getAnnouncement: (id: string) =>
    api.get<Announcement>(`/governance/announcements/${id}/`).then(r => r.data),
  createAnnouncement: (data: Partial<Announcement> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.post<Announcement>(
      '/governance/announcements/',
      data,
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },
  updateAnnouncement: (id: string, data: Partial<Announcement> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.patch<Announcement>(
      `/governance/announcements/${id}/`,
      data,
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },
  removeAnnouncement: (id: string) =>
    api.delete(`/governance/announcements/${id}/`).then(r => r.data),
  markAnnouncementRead: (id: string) =>
    api.post(`/governance/announcements/${id}/mark_read/`).then(r => r.data),
  unreadAnnouncements: () =>
    api.get<{ count: number }>('/governance/announcements/unread_count/').then(r => r.data),
};
