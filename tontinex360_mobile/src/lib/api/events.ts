// Ported from web front (src/lib/api/events.ts) — member-facing subset.
import api, { unwrap, Paginated } from './client';

export interface AppEvent {
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
  minutes?: string;
  attachments?: unknown[];
  audience_mode: 'all' | 'specific';
  invitees?: string[];
  invitee_names?: { id: string; name: string }[];
  invitees_count?: number;
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
    api.get<AppEvent[] | Paginated<AppEvent>>('/events/events/', { params }).then((r) => unwrap(r.data)),

  get: (id: string) => api.get<AppEvent>(`/events/events/${id}/`).then((r) => r.data),

  // ---------- Bureau : gestion des événements ----------
  create: (data: Partial<AppEvent>) =>
    api.post<AppEvent>('/events/events/', data).then((r) => r.data),
  update: (id: string, data: Partial<AppEvent>) =>
    api.patch<AppEvent>(`/events/events/${id}/`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/events/events/${id}/`).then((r) => r.data),

  attendances: (eventId: string) =>
    api
      .get<EventAttendance[] | Paginated<EventAttendance>>('/events/attendances/', {
        params: { event: eventId },
      })
      .then((r) => unwrap(r.data)),

  // Confirm presence (real route: POST /events/attendances/ with {event, membership, is_present}).
  setAttendance: (data: { event: string; membership: string; is_present: boolean }) =>
    api.post<EventAttendance>('/events/attendances/', data).then((r) => r.data),

  updateAttendance: (id: string, data: Partial<EventAttendance>) =>
    api.patch<EventAttendance>(`/events/attendances/${id}/`, data).then((r) => r.data),

  /**
   * Confirme la présence du membre à un événement.
   * Le backend pré-crée une EventAttendance (is_present=false) à la création de
   * l'event, donc on met à jour la ligne existante (PATCH) ; sinon on la crée.
   */
  confirmPresence: async (eventId: string, membershipId: string) => {
    const r = await api.get<EventAttendance[] | Paginated<EventAttendance>>(
      '/events/attendances/',
      { params: { event: eventId } },
    );
    const mine = unwrap(r.data).find((x) => x.membership === membershipId);
    if (mine) {
      return api
        .patch<EventAttendance>(`/events/attendances/${mine.id}/`, { is_present: true })
        .then((res) => res.data);
    }
    return api
      .post<EventAttendance>('/events/attendances/', {
        event: eventId,
        membership: membershipId,
        is_present: true,
      })
      .then((res) => res.data);
  },
};

/** Event type -> short FR label (no "mandatory" field exists on the backend). */
export const EVENT_TYPE_LABEL: Record<string, string> = {
  ag: 'Assemblée Générale',
  age: 'AG Extraordinaire',
  meeting: 'Réunion',
  celebration: 'Célébration',
  workshop: 'Atelier',
  other: 'Événement',
};
