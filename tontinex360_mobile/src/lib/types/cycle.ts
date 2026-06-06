// Ported from web front (src/lib/types/cycle.ts) — trimmed.
export type CycleStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: CycleStatus;
  session_count: number;
  created_at: string;
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
