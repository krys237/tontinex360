/**
 * Catalogue des destinations recherchables de l'espace bureau (recherche
 * globale « trouver un module / une fonctionnalité »).
 *
 * INVARIANT : n'inclure que des routes SANS paramètre requis. Les écrans de
 * détail (`Bureau*Detail: { id }`, `BureauSanctionCorrect: { id }`) sont exclus
 * — on ne peut pas y atterrir sans un id. Les formulaires à `{ id? }` optionnel
 * sont admis (mode création). Un test de cohérence (search-catalog.guard) vérifie
 * que chaque `route` existe et n'exige pas de param.
 *
 * `keywords` encode le vocabulaire réel des utilisateurs (synonymes, sigles) —
 * c'est le levier principal de pertinence : « PV » → Séances, « AG » → Calendrier,
 * « emprunt » → Prêts, « rôle » → Paramètres.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { BureauStackParamList } from '../../navigation/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type CatalogEntry = {
  key: string;
  label: string;
  module: string;
  icon: IoniconName;
  keywords: string[];
  /** Route bureau sans param requis (ou params optionnels). */
  route?: keyof BureauStackParamList;
  /** Params optionnels (ex: onglet de Paramètres, canal d'invitation). */
  params?: Record<string, unknown>;
  /** Route du stack parent (AppStack) — pour le chat du bureau. */
  parent?: string;
};

export const BUREAU_CATALOG: CatalogEntry[] = [
  // ── Vue d'ensemble ────────────────────────────────────────────────
  { key: 'overview', module: "Vue d'ensemble", label: 'Tableau de bord', icon: 'grid', route: 'BureauOverview',
    keywords: ['tableau', 'bord', 'dashboard', 'kpi', 'statistiques', 'vue', 'globale', 'accueil'] },

  // ── Membres ───────────────────────────────────────────────────────
  { key: 'members', module: 'Membres', label: 'Membres', icon: 'people', route: 'BureauMembers',
    keywords: ['membre', 'adherent', 'liste', 'annuaire', 'personne', 'utilisateur', 'demission'] },
  { key: 'invitations-overview', module: 'Membres', label: 'Invitations', icon: 'mail', route: 'BureauInvitationsOverview',
    keywords: ['invitation', 'inviter', 'onboarding', 'suivi'] },
  { key: 'invite', module: 'Membres', label: 'Inviter un membre', icon: 'person-add', route: 'BureauInvitations',
    keywords: ['inviter', 'nouveau', 'membre', 'email', 'sms', 'whatsapp', 'lien', 'onboarding'] },
  { key: 'fees-overview', module: 'Membres', label: "Frais d'adhésion", icon: 'pricetag', route: 'BureauFeesOverview',
    keywords: ['frais', 'adhesion', 'cotisation', 'entree', 'inscription'] },
  { key: 'fees-config', module: 'Membres', label: 'Configurer les frais', icon: 'options', route: 'BureauFeesConfig',
    keywords: ['frais', 'configurer', 'reglage', 'montant', 'adhesion'] },
  { key: 'import', module: 'Membres', label: 'Import de membres', icon: 'cloud-upload', route: 'BureauImport',
    keywords: ['import', 'importer', 'csv', 'excel', 'fichier', 'masse', 'batch'] },

  // ── Bureau & gouvernance ──────────────────────────────────────────
  { key: 'board', module: 'Gouvernance', label: 'Bureau', icon: 'ribbon', route: 'BureauBoard',
    keywords: ['bureau', 'responsable', 'mandat', 'poste', 'president', 'tresorier', 'secretaire'] },
  { key: 'approvals', module: 'Gouvernance', label: 'Approbations', icon: 'checkmark-done-circle', route: 'BureauApprovals',
    keywords: ['approbation', 'validation', 'valider', 'triple', 'sensible', 'demande'] },
  { key: 'governance', module: 'Gouvernance', label: 'Gouvernance', icon: 'podium', route: 'BureauGovernance',
    keywords: ['gouvernance', 'annonce', 'sondage', 'vote', 'election', 'document', 'communication'] },
  { key: 'announcement-new', module: 'Gouvernance', label: 'Nouvelle annonce', icon: 'megaphone', route: 'BureauAnnouncementForm',
    keywords: ['annonce', 'communiquer', 'message', 'information', 'nouvelle'] },
  { key: 'poll-new', module: 'Gouvernance', label: 'Nouveau sondage', icon: 'stats-chart', route: 'BureauPollForm',
    keywords: ['sondage', 'vote', 'consultation', 'question', 'nouveau'] },
  { key: 'election-new', module: 'Gouvernance', label: 'Nouvelle élection', icon: 'podium', route: 'BureauElectionForm',
    keywords: ['election', 'vote', 'candidat', 'scrutin', 'mandat', 'nouvelle'] },
  { key: 'document-new', module: 'Gouvernance', label: 'Nouveau document', icon: 'document-attach', route: 'BureauDocumentForm',
    keywords: ['document', 'fichier', 'pv', 'statut', 'reglement', 'pièce', 'nouveau'] },

  // ── Calendrier ────────────────────────────────────────────────────
  { key: 'events', module: 'Calendrier', label: 'Calendrier', icon: 'calendar-number', route: 'BureauEvents',
    keywords: ['calendrier', 'evenement', 'ag', 'assemblee', 'reunion', 'agenda', 'date'] },
  { key: 'event-new', module: 'Calendrier', label: 'Nouvel événement', icon: 'add-circle', route: 'BureauEventForm',
    keywords: ['evenement', 'creer', 'ajouter', 'ag', 'reunion', 'nouveau'] },

  // ── Finance ───────────────────────────────────────────────────────
  { key: 'finance', module: 'Finance', label: 'Finance', icon: 'cash', route: 'BureauFinance',
    keywords: ['finance', 'cotisation', 'pret', 'emprunt', 'argent', 'paiement', 'versement'] },
  { key: 'loan-allocate', module: 'Finance', label: 'Allocation des prêts', icon: 'git-branch', route: 'BureauLoanAllocate',
    keywords: ['pret', 'emprunt', 'allocation', 'allouer', 'credit', 'octroi'] },
  { key: 'guarantees', module: 'Finance', label: 'Mes garanties', icon: 'shield-checkmark', route: 'BureauMyGuarantees',
    keywords: ['garantie', 'caution', 'aval', 'pret', 'garant'] },
  { key: 'treasury', module: 'Finance', label: 'Trésorerie', icon: 'wallet', route: 'BureauTreasury',
    keywords: ['tresorerie', 'caisse', 'solde', 'compte', 'banque', 'liquidite'] },
  { key: 'withdrawals', module: 'Finance', label: 'Retraits de trésorerie', icon: 'arrow-up-circle', route: 'BureauWithdrawals',
    keywords: ['retrait', 'depense', 'sortie', 'fonds', 'decaissement', 'remboursable', 'dette'] },
  { key: 'wallets', module: 'Finance', label: 'Portefeuilles', icon: 'card', route: 'BureauWallets',
    keywords: ['portefeuille', 'wallet', 'solde', 'ajustement', 'compte', 'membre'] },

  // ── Cycles & séances ──────────────────────────────────────────────
  { key: 'cycles', module: 'Cycles & séances', label: 'Cycles', icon: 'reload-circle', route: 'BureauCycles',
    keywords: ['cycle', 'cagnotte', 'pot', 'periode', 'exercice', 'rotation'] },
  { key: 'cycle-new', module: 'Cycles & séances', label: 'Nouveau cycle', icon: 'add-circle', route: 'BureauCycleCreate',
    keywords: ['cycle', 'creer', 'demarrer', 'nouveau', 'periode'] },
  { key: 'tontine-type', module: 'Cycles & séances', label: 'Type de cotisation', icon: 'layers', route: 'BureauTontineTypeForm',
    keywords: ['type', 'tontine', 'cotisation', 'mode', 'montant', 'configurer'] },
  { key: 'sessions', module: 'Cycles & séances', label: 'Séances', icon: 'calendar', route: 'BureauSessions',
    keywords: ['seance', 'reunion', 'presence', 'pv', 'proces', 'verbal', 'appel'] },
  { key: 'session-new', module: 'Cycles & séances', label: 'Nouvelle séance', icon: 'add-circle', route: 'BureauSessionCreate',
    keywords: ['seance', 'creer', 'planifier', 'nouvelle', 'reunion'] },

  // ── Sanctions ─────────────────────────────────────────────────────
  { key: 'sanctions', module: 'Sanctions', label: 'Sanctions', icon: 'warning', route: 'BureauSanctions',
    keywords: ['sanction', 'penalite', 'amende', 'retard', 'faute', 'discipline'] },
  { key: 'sanction-apply', module: 'Sanctions', label: 'Appliquer une sanction', icon: 'hand-left', route: 'BureauSanctionApply',
    keywords: ['sanction', 'appliquer', 'penaliser', 'amende', 'infliger'] },
  { key: 'sanction-type', module: 'Sanctions', label: 'Type de sanction', icon: 'construct', route: 'BureauSanctionTypeForm',
    keywords: ['sanction', 'type', 'bareme', 'configurer', 'penalite'] },

  // ── Procurations ──────────────────────────────────────────────────
  { key: 'proxies', module: 'Procurations', label: 'Procurations', icon: 'people-circle', route: 'BureauProxies',
    keywords: ['procuration', 'mandat', 'delegation', 'representer', 'proxy'] },

  // ── Administration ────────────────────────────────────────────────
  { key: 'settings', module: 'Administration', label: 'Paramètres du bureau', icon: 'briefcase', route: 'BureauSettings',
    keywords: ['parametre', 'reglage', 'configuration', 'admin', 'regle'] },
  { key: 'settings-roles', module: 'Administration', label: 'Rôles & permissions', icon: 'key', route: 'BureauSettings', params: { tab: 'roles' },
    keywords: ['role', 'permission', 'droit', 'acces', 'habilitation'] },
  { key: 'settings-positions', module: 'Administration', label: 'Postes du bureau', icon: 'ribbon', route: 'BureauSettings', params: { tab: 'positions' },
    keywords: ['poste', 'fonction', 'president', 'tresorier', 'secretaire', 'mandat'] },
  { key: 'settings-policies', module: 'Administration', label: 'Règles & policies', icon: 'shield', route: 'BureauSettings', params: { tab: 'policies' },
    keywords: ['regle', 'policy', 'wallet', 'procuration', 'politique'] },
  { key: 'settings-loans', module: 'Administration', label: 'Paramètres des prêts', icon: 'cash', route: 'BureauSettings', params: { tab: 'loans' },
    keywords: ['pret', 'emprunt', 'taux', 'interet', 'plafond', 'regle', 'configurer'] },

  // ── Discussion (stack parent) ─────────────────────────────────────
  { key: 'chat', module: 'Discussion', label: 'Discussion du bureau', icon: 'chatbubbles', parent: 'Chat',
    keywords: ['chat', 'discussion', 'message', 'echange', 'conversation'] },
];

/**
 * Routes bureau exigeant un paramètre requis (`{ id }`, etc.) : INTERDITES dans
 * le catalogue — on ne peut pas y naviguer à froid. Le typecheck garantit déjà
 * que `route` est une route valide ; ce garde-fou dev vérifie en plus qu'aucune
 * entrée ne cible une de ces destinations à paramètre requis.
 */
const PARAM_REQUIRED_ROUTES: ReadonlySet<string> = new Set([
  'BureauMemberDetail', 'BureauApprovalDetail', 'BureauContributionDetail',
  'BureauLoanDetail', 'BureauCycleDetail', 'BureauSessionDetail', 'BureauPotDetail',
  'BureauAnnouncementDetail', 'BureauDocumentDetail', 'BureauPollDetail',
  'BureauElectionDetail', 'BureauSanctionCorrect',
]);

if (__DEV__) {
  for (const e of BUREAU_CATALOG) {
    if (!e.route && !e.parent) {
      console.warn(`[search-catalog] "${e.key}" n'a ni route ni parent — inatteignable.`);
    }
    if (e.route && PARAM_REQUIRED_ROUTES.has(e.route)) {
      console.warn(
        `[search-catalog] "${e.key}" cible "${e.route}" qui exige un paramètre requis — à retirer.`,
      );
    }
  }
}
