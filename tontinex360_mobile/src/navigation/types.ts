// Navigation param lists.
import type { NavigatorScreenParams } from '@react-navigation/native';

export type IntroStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Tour: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyOtp: { telephone?: string } | undefined;
  ForgotPassword: undefined;
  InviteAccept: { token?: string } | undefined;
};

export type WorkspaceStackParamList = {
  NoAssociation: undefined;
  CreateAssociation: undefined;
  JoinRequest: undefined;
};

// Member app — 5-tab bottom navigation (design handoff).
export type AppTabsParamList = {
  Accueil: undefined;
  Tontines: undefined;
  Communaute: undefined;
  Finances: undefined;
  Profil: undefined;
};

// Bureau (espace exécutif) — stack séparé, poussé depuis l'espace membre.
export type BureauStackParamList = {
  BureauDashboard: undefined;
  // Phase 2 — Membres
  BureauMembers: undefined;
  BureauMemberDetail: { id: string };
  BureauInvitations: undefined;
  // Phase 3 — Approbations
  BureauApprovals: undefined;
  BureauApprovalDetail: { id: string };
  // Phase 4 — Finance
  BureauFinance: undefined;
  BureauContributionDetail: { id: string };
  BureauLoanDetail: { id: string };
};

// Stack wrapping the tabs (lets screens push detail/modal views like Notifications).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<AppTabsParamList>;
  Bureau: NavigatorScreenParams<BureauStackParamList>;
  Notifications: undefined;
  AnnouncementDetail: { id: string };
  EventDetail: { id: string };
  SessionDetail: { id: string };
  PollDetail: { id: string };
  Chat: undefined;
  Conversation: { id: string; title: string };
  Procurations: undefined;
  MesTontines: undefined;
  MesEncheres: undefined;
  MesVersements: undefined;
  Cotiser: {
    membershipId: string;
    tontineTypeId: string;
    tontineName: string;
    cycleId: string;
    numShares: number;
    ratePerShare: number;
    amountPerSession: number;
  };
};

export type RootStackParamList = {
  Intro: NavigatorScreenParams<IntroStackParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Workspace: NavigatorScreenParams<WorkspaceStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};
