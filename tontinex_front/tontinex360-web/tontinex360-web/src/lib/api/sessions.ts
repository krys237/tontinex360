import api from './client';
import type { Session, SessionAttendance } from '@/lib/types/cycle';

export const sessionsApi = {
  // Sessions
  list: (params?: { cycle?: string; status?: string }) =>
    api.get<Session[]>('/cycles/sessions/', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Session>(`/cycles/sessions/${id}/`).then(r => r.data),
  create: (data: Partial<Session>) =>
    api.post<Session>('/cycles/sessions/', data).then(r => r.data),
  update: (id: string, data: Partial<Session>) =>
    api.patch<Session>(`/cycles/sessions/${id}/`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/cycles/sessions/${id}/`).then(r => r.data),

  // Attendances
  attendances: (sessionId: string) =>
    api.get<SessionAttendance[]>('/cycles/attendances/', {
      params: { session: sessionId },
    }).then(r => r.data),
  setAttendance: (data: {
    session: string; membership: string;
    status: 'present' | 'absent' | 'excused' | 'late' | 'represented';
    represented_by?: string | null;
    notes?: string;
  }) => api.post<SessionAttendance>('/cycles/attendances/', data).then(r => r.data),
  updateAttendance: (id: string, data: Partial<SessionAttendance>) =>
    api.patch(`/cycles/attendances/${id}/`, data).then(r => r.data),
};
