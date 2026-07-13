// Ported from web front (src/lib/types/cycle.ts) — trimmed.
export type CycleStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'represented';
export type RecurrenceKind = 'none' | 'fixed_day_of_month' | 'nth_weekday' | 'every_weekday';

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

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: CycleStatus;
  session_count: number;
  session_frequency?: string;
  default_session_day?: number;
  default_session_time?: string;
  default_session_location?: string;
  tontine_configs?: CycleTontineConfig[];
  recurrence_kind?: RecurrenceKind;
  recurrence_nth?: number | null;
  recurrence_weekday?: number | null;
  recurrence_day_of_month?: number | null;
  sessions_generated_at?: string | null;
  created_at: string;
}

export interface SessionAttendance {
  id: string;
  session: string;
  membership: string;
  member_name: string;
  status: AttendanceStatus;
  represented_by?: string | null;
  notes?: string;
}

export type AuctionBidStatus = 'active' | 'won' | 'lost' | 'cancelled';

export interface AuctionBid {
  id: string;
  pot: string;
  membership: string;
  member_name?: string;
  bid_amount: number | string;
  status: AuctionBidStatus;
  resulting_payout?: string | null;
  created_at: string;
}

export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

export interface Session {
  id: string;
  cycle: string;
  session_number: number;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location: string;
  status: SessionStatus;
  host_member?: string | null;
  host_member_name?: string | null;
  minutes?: string;
  notes?: string;
}
