// Sessions API (bureau) — porté du web front (src/lib/api/sessions.ts).
import api, { unwrap, Paginated } from './client';
import type { Session, SessionAttendance } from '../types/cycle';
import type { SessionLotsForType } from '../types/pot';

export interface SessionFullReport {
  session: {
    id: string;
    session_number: number | null;
    date: string | null;
    location: string;
    status: string;
    cycle_name: string | null;
  };
  attendance_summary: {
    expected: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
    represented: number;
    no_record: number;
  };
  contributions_by_tontine: Array<{
    tontine_name: string;
    currency: string;
    total_expected: number;
    total_collected: number;
    count_paid: number;
  }>;
  totals: {
    grand_expected: number;
    grand_collected: number;
    completion_rate_percent: number;
    total_distributed: number;
    total_remainder: number;
  };
}

export interface SessionReport {
  id: string;
  session: string;
  session_number: number;
  session_date: string;
  author_name: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  can_edit?: boolean;
  created_at: string;
}

/** Politique de pointage de l'association (Association.settings.attendance). */
export interface AttendanceConfig {
  /** manual = le bureau pose les statuts ; auto = présent/retard selon la marge. */
  mode: 'manual' | 'auto';
  late_after_minutes: number;
  absent_on_close: boolean;
  allow_self_checkin: boolean;
}

export interface JoinSessionResult {
  created: boolean;
  attendance: SessionAttendance;
  mode: AttendanceConfig['mode'];
}

export const sessionsApi = {
  list: (params?: { cycle?: string; status?: string }) =>
    api
      .get<Session[] | Paginated<Session>>('/cycles/sessions/', { params })
      .then((r) => unwrap(r.data)),
  get: (id: string) => api.get<Session>(`/cycles/sessions/${id}/`).then((r) => r.data),
  create: (data: Partial<Session>) =>
    api.post<Session>('/cycles/sessions/', data).then((r) => r.data),
  update: (id: string, data: Partial<Session>) =>
    api.patch<Session>(`/cycles/sessions/${id}/`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/cycles/sessions/${id}/`).then((r) => r.data),

  /** Rapport complet (présences, cotisations, pots, totaux). */
  fullReport: (sessionId: string) =>
    api.get<SessionFullReport>(`/cycles/sessions/${sessionId}/report/`).then((r) => r.data),

  /** Clôture la séance et renvoie le rapport final. */
  closeSession: (sessionId: string) =>
    api.post<SessionFullReport>(`/cycles/sessions/${sessionId}/close/`, {}).then((r) => r.data),

  /** Lots distribuables calculés pour cette séance, par type de tontine. */
  lots: (sessionId: string) =>
    api.get<SessionLotsForType[]>(`/cycles/sessions/${sessionId}/lots/`).then((r) => r.data),

  // ---------- Présences ----------
  attendances: (sessionId: string) =>
    api
      .get<SessionAttendance[] | Paginated<SessionAttendance>>('/cycles/attendances/', {
        params: { session: sessionId },
      })
      .then((r) => unwrap(r.data)),
  setAttendance: (data: {
    session: string;
    membership: string;
    status: 'present' | 'absent' | 'excused' | 'late' | 'represented';
    represented_by?: string | null;
    notes?: string;
  }) => api.post<SessionAttendance>('/cycles/attendances/', data).then((r) => r.data),
  updateAttendance: (id: string, data: Partial<SessionAttendance>) =>
    api.patch<SessionAttendance>(`/cycles/attendances/${id}/`, data).then((r) => r.data),

  /** Self check-in du membre (« Je suis présent ») sur une séance ouverte.
   *  Le STATUT est décidé par le serveur : présent/retard selon la marge en
   *  mode auto, présent en mode manuel (le bureau ajuste). Idempotent : ne
   *  déplace pas l'heure d'arrivée et n'écrase jamais une décision bureau. */
  joinSession: (sessionId: string) =>
    api.post<JoinSessionResult>(`/cycles/sessions/${sessionId}/join/`, {}).then((r) => r.data),

  /** Politique de pointage — lecture ouverte à tout membre. */
  attendanceConfig: () =>
    api.get<AttendanceConfig>('/cycles/attendance-config/').then((r) => r.data),

  /** Politique de pointage — modification réservée au bureau. */
  updateAttendanceConfig: (data: Partial<AttendanceConfig>) =>
    api.patch<AttendanceConfig>('/cycles/attendance-config/', data).then((r) => r.data),

  // ---------- Procès-verbaux ----------
  reports: (sessionId: string) =>
    api
      .get<SessionReport[] | Paginated<SessionReport>>('/cycles/session-reports/', {
        params: { session: sessionId },
      })
      .then((r) => unwrap(r.data)),
  createReport: (data: { session: string; title?: string; content: string; publish?: boolean }) =>
    api.post<SessionReport>('/cycles/session-reports/', data).then((r) => r.data),
  publishReport: (id: string) =>
    api.post<SessionReport>(`/cycles/session-reports/${id}/publish/`, {}).then((r) => r.data),
  unpublishReport: (id: string) =>
    api.post<SessionReport>(`/cycles/session-reports/${id}/unpublish/`, {}).then((r) => r.data),
};
