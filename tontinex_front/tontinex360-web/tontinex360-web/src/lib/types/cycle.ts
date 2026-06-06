export type CycleStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'represented';

export type RecurrenceKind = 'none' | 'fixed_day_of_month' | 'nth_weekday' | 'every_weekday';

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: CycleStatus;
  session_frequency: string;
  default_session_day?: number;
  default_session_time?: string;
  default_session_location: string;
  tontine_configs: CycleTontineConfig[];
  session_count: number;
  // Pattern de récurrence
  recurrence_kind?: RecurrenceKind;
  recurrence_nth?: number | null;
  recurrence_weekday?: number | null;
  recurrence_day_of_month?: number | null;
  sessions_generated_at?: string | null;
  created_at: string;
}

export interface CycleTontineConfig {
  id: string;
  tontine_type: string;
  tontine_name: string;
  default_method: string;
  default_method_display: string;
  allow_override: boolean;
  allowed_overrides: string[];
  auction_premium_destination: string;
  config: Record<string, any>;
}

export interface Session {
  id: string;
  cycle: string;
  session_number: number;
  date: string;
  start_time?: string;
  end_time?: string;
  location: string;
  host_member?: string | null;
  host_member_name?: string | null;
  status: SessionStatus;
  minutes: string;
  notes: string;
  created_at: string;
}

export interface SessionAttendance {
  id: string;
  session: string;
  membership: string;
  member_name: string;
  status: AttendanceStatus;
  represented_by?: string;
  notes: string;
}
