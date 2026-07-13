// Ported 1:1 from the web front (src/lib/types/auth.ts) to keep API contracts aligned.

export interface UserAssociationMinimal {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  city?: string;
}

export interface User {
  id: string;
  telephone: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar?: string;
  language?: string;
  associations?: UserAssociationMinimal[];
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface LoginRequest {
  telephone: string;
  password: string;
}

export interface RegisterRequest {
  telephone: string;
  first_name: string;
  last_name: string;
  email?: string;
  password: string;
  password_confirm: string;
}

export interface Association {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo?: string;
  city?: string;
  region?: string;
  country?: string;
  is_active: boolean;
  founded_date?: string | null;
  created_at: string;
  settings?: Record<string, any>;
}

/** Résultat de recherche publique d'association (avant adhésion). */
export interface AssociationSearchResult {
  id: string;
  name: string;
  slug: string;
  city: string;
  description: string;
  logo?: string | null;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Demande d'adhésion envoyée par l'utilisateur courant. */
export interface MyJoinRequest {
  id: string;
  association_slug: string;
  association_name: string;
  association_logo?: string | null;
  status: JoinRequestStatus;
  motivation: string;
  review_note: string;
  created_at: string;
  reviewed_at?: string | null;
}
