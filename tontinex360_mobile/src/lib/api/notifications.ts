// Ported from web front (src/lib/api/notifications.ts).
import api, { unwrap, Paginated } from './client';
import type { Notification } from '../types/notification';

export interface NotificationPreference {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  muted_types: string[];
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export const notificationsApi = {
  list: (params?: { is_read?: boolean; notification_type?: string }) =>
    api
      .get<Notification[] | Paginated<Notification>>('/notifications/', { params })
      .then((r) => unwrap(r.data)),

  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread_count/').then((r) => r.data.count),

  markRead: (ids: string[]) =>
    api.post('/notifications/mark_read/', { ids }).then((r) => r.data),

  markAllRead: () => api.post('/notifications/mark_all_read/').then((r) => r.data),

  preferences: () =>
    api.get<NotificationPreference>('/notifications/preferences/').then((r) => r.data),

  updatePreferences: (data: Partial<NotificationPreference>) =>
    api
      .put<NotificationPreference>('/notifications/preferences/', data)
      .then((r) => r.data),
};
