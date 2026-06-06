import api from './client';

export type AudienceMode = 'all' | 'specific';

export interface InviteeSummary {
  id: string;
  name: string;
}

export interface Event {
  id: string;
  title: string;
  event_type: string;
  description: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location: string;
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  cycle?: string | null;
  organized_by?: string | null;
  minutes?: string;
  attachments?: any[];
  // Audience
  audience_mode: AudienceMode;
  audience_mode_display?: string;
  invitees?: string[];              // ids des memberships invités (specific)
  invitee_names?: InviteeSummary[]; // lecture (id + nom)
  invitees_count?: number;          // total des invités (calculé : actifs si 'all', explicite si 'specific')
  created_at?: string;
}

export interface EventAttendance {
  id: string;
  event: string;
  membership: string;
  member_name?: string;
  is_present: boolean;
  notes?: string;
}

export const eventsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Event[]>('/events/events/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Event>(`/events/events/${id}/`).then(r => r.data),
  create: (data: Partial<Event>) =>
    api.post<Event>('/events/events/', data).then(r => r.data),
  update: (id: string, data: Partial<Event>) =>
    api.patch<Event>(`/events/events/${id}/`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/events/events/${id}/`).then(r => r.data),

  resyncAttendances: (id: string) =>
    api.post<{ created: number; total: number }>(
      `/events/events/${id}/resync-attendances/`,
    ).then(r => r.data),

  attendances: (eventId: string) =>
    api.get<EventAttendance[]>('/events/attendances/', { params: { event: eventId } })
      .then(r => r.data),
  setAttendance: (data: Partial<EventAttendance>) =>
    api.post<EventAttendance>('/events/attendances/', data).then(r => r.data),
  updateAttendance: (id: string, data: Partial<EventAttendance>) =>
    api.patch<EventAttendance>(`/events/attendances/${id}/`, data).then(r => r.data),
};
