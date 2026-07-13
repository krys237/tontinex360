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
  ChooseAssociation: undefined;
  NoAssociation: undefined;
  CreateAssociation: undefined;
  JoinRequest: undefined;
  MyJoinRequests: undefined;
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
  BureauOverview: undefined;
  // Phase 2 — Membres
  BureauMembers: undefined;
  BureauMemberDetail: { id: string };
  BureauInvitationsOverview: undefined;
  BureauInvitations: { channel?: 'email' | 'sms' | 'whatsapp' | 'link' } | undefined;
  BureauFeesOverview: undefined;
  BureauFeesConfig: undefined;
  BureauImport: undefined;
  // Phase 3 — Approbations
  BureauApprovals: undefined;
  BureauApprovalDetail: { id: string };
  // Phase 4 — Finance
  BureauFinance: undefined;
  BureauContributionDetail: { id: string };
  BureauLoanDetail: { id: string };
  BureauLoanAllocate: undefined;
  BureauMyGuarantees: undefined;
  BureauTreasury: undefined;
  // Phase 5 — Cycles & séances
  BureauCycles: undefined;
  BureauCycleCreate: undefined;
  BureauCycleDetail: { id: string };
  BureauTontineTypeForm: { id?: string } | undefined;
  BureauSessions: undefined;
  BureauSessionCreate: { cycleId?: string } | undefined;
  BureauSessionDetail: { id: string };
  BureauPotDetail: { id: string };
  // Calendrier / Événements
  BureauEvents: undefined;
  BureauEventForm: { id?: string } | undefined;
  // Phase 6 — Gouvernance
  BureauGovernance: undefined;
  BureauAnnouncementForm: { id?: string } | undefined;
  BureauAnnouncementDetail: { id: string };
  BureauDocumentDetail: { id: string };
  BureauPollForm: undefined;
  BureauPollDetail: { id: string };
  BureauElectionForm: undefined;
  BureauElectionDetail: { id: string };
  BureauDocumentForm: { id?: string } | undefined;
  // Phase 7 — Sanctions, Wallets, Procurations
  BureauSanctions: undefined;
  BureauSanctionApply: { typeId?: string; id?: string } | undefined;
  BureauSanctionCorrect: { id: string };
  BureauSanctionTypeForm: { id?: string } | undefined;
  BureauWallets: undefined;
  BureauProxies: undefined;
  // Bureau (gouvernance)
  BureauBoard: undefined;
  // Phase 8 — Paramètres
  BureauSettings: { tab?: 'roles' | 'positions' | 'policies' | 'loans' } | undefined;
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
  ChatNewPrivate: undefined;
  ChatNewGroup: undefined;
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
