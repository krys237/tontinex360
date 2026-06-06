export type ProxyStatus =
  | 'pending' | 'approved' | 'used'
  | 'rejected' | 'cancelled' | 'expired';

export interface Proxy {
  id: string;
  principal: string;
  principal_name: string;
  proxy: string;
  proxy_name: string;
  session: string;
  session_number?: number | null;
  session_date?: string | null;
  tontine_type?: string | null;
  tontine_name?: string | null;
  reason: string;
  signed_document?: string | null;
  signature_image?: string | null;
  cni_image?: string | null;
  status: ProxyStatus;
  status_display?: string;
  requested_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  review_note: string;
  used_at?: string | null;
  resulting_payout?: string | null;
  created_at: string;
  updated_at?: string;
}
