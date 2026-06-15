// Ported 1:1 from the web front (src/lib/types/member.ts).

export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'expelled' | 'resigned';

export interface MembershipUser {
  id: string;
  first_name: string;
  last_name: string;
  telephone: string;
  email: string | null;
  avatar?: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  is_bureau_role: boolean;
  is_system: boolean;
  hierarchy_level: number;
}

export interface MemberRole {
  id: string;
  membership?: string;
  role: Role;
  is_active: boolean;
  assigned_by?: string;
  created_at?: string;
}

export interface Membership {
  id: string;
  user: MembershipUser;
  association?: string;
  member_number: string;
  status: MembershipStatus;
  is_active: boolean;
  is_founder?: boolean;
  joined_date: string;
  extra_data?: Record<string, any>;
  roles: MemberRole[];
  signature_reference?: string | null;
  signature_reference_at?: string | null;
  has_signature?: boolean;
  created_at?: string;
}

export interface MembershipListItem {
  id: string;
  user_name: string;
  /** Null si le viewer n'est pas membre du bureau (confidentialité). */
  user_telephone: string | null;
  member_number: string;
  status: MembershipStatus;
  is_active: boolean;
  is_founder?: boolean;
  /** Position bureau si actif (« Président », « Trésorier »…), sinon « Membre ». */
  bureau_position?: string;
}

// ---------- Bureau (postes & mandats) ----------
export interface BureauPosition {
  id: string;
  name: string;
  slug: string;
  description: string;
  display_order: number;
  is_required: boolean;
  default_role: string | null;
}

export interface BureauMember {
  id: string;
  membership: MembershipListItem;
  position: BureauPosition;
  cycle?: string | null;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  designation_method: string;
}

// ---------- Demandes d'adhésion ----------
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface MembershipRequest {
  id: string;
  user: MembershipUser;
  cycle?: string | null;
  motivation: string;
  contact_phone: string;
  contact_email: string;
  status: MembershipRequestStatus;
  status_display: string;
  reviewed_by?: MembershipListItem | null;
  review_note: string;
  reviewed_at?: string | null;
  resulting_membership?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Démissions ----------
export type ResignationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Resignation {
  id: string;
  membership: MembershipListItem;
  reason: string;
  effective_date?: string | null;
  status: ResignationStatus;
  status_display: string;
  reviewed_by?: MembershipListItem | null;
  review_note: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}
