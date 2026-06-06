// Ported from web front (src/lib/types/notification.ts).
export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  channel: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}
