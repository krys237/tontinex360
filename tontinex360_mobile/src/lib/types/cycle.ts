// Ported from web front (src/lib/types/cycle.ts) — trimmed.
export type CycleStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'represented';
export type RecurrenceKind =
  | 'none'
  | 'fixed_day_of_month'
  | 'nth_weekday'
  | 'every_weekday'
  | 'weekly_multiple'
  | 'daily'
  | 'custom_dates';

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
  /** `weekly_multiple` / `daily` : jours de semaine, 0=lundi … 6=dimanche. */
  recurrence_weekdays?: number[];
  /** `custom_dates` : dates ISO explicites (YYYY-MM-DD). */
  recurrence_custom_dates?: string[];
  /** `weekly_multiple` : pas en semaines. `daily` : pas en jours. */
  recurrence_interval?: number;
  /** Lecture seule : 12 prochaines dates calculées par le serveur. */
  preview_dates?: string[];
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
  /** Horodatage d'arrivée — posé par le serveur (join/ ou saisie bureau), jamais par le client. */
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  /** Origine du pointage : self (bouton « Je suis présent ») ou bureau. */
  source?: 'self' | 'bureau' | string;
}

export type AuctionBidStatus = 'active' | 'won' | 'lost' | 'cancelled';

export interface AuctionBid {
  id: string;
  pot: string;
  membership: string;
  member_name?: string;
  bid_amount: number | string;
  shares_requested?: number | string;
  target_lot?: number | string;
  status: AuctionBidStatus;
  resulting_payout?: string | null;
  created_at: string;
}

export interface SessionPot {
  id: string;
  session: string;
  tontine_type: string;
  tontine_name: string;
  total_collected: number | string;
  carry_over_in: number | string;
  auction_premium_in: number | string;
  total_available: number | string;
  total_distributed: number | string;
  remainder: number | string;
  effective_method: string;
  method_display: string;
  is_closed: boolean;
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
