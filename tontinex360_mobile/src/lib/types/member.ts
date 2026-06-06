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
  user_telephone: string;
  member_number: string;
  status: MembershipStatus;
  is_active: boolean;
  is_founder?: boolean;
}
