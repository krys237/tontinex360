import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BureauStackParamList } from './types';
import BureauDashboardScreen from '../screens/bureau/BureauDashboardScreen';
import BureauSearchScreen from '../screens/bureau/BureauSearchScreen';
import BureauOverviewScreen from '../screens/bureau/BureauOverviewScreen';
import BureauMembersScreen from '../screens/bureau/BureauMembersScreen';
import BureauMemberDetailScreen from '../screens/bureau/BureauMemberDetailScreen';
import BureauInvitationsOverviewScreen from '../screens/bureau/BureauInvitationsOverviewScreen';
import BureauInvitationsScreen from '../screens/bureau/BureauInvitationsScreen';
import BureauFeesOverviewScreen from '../screens/bureau/BureauFeesOverviewScreen';
import BureauFeesConfigScreen from '../screens/bureau/BureauFeesConfigScreen';
import BureauImportScreen from '../screens/bureau/BureauImportScreen';
import BureauApprovalsScreen from '../screens/bureau/BureauApprovalsScreen';
import BureauApprovalDetailScreen from '../screens/bureau/BureauApprovalDetailScreen';
import BureauFinanceScreen from '../screens/bureau/BureauFinanceScreen';
import BureauContributionDetailScreen from '../screens/bureau/BureauContributionDetailScreen';
import BureauLoanDetailScreen from '../screens/bureau/BureauLoanDetailScreen';
import BureauLoanAllocateScreen from '../screens/bureau/BureauLoanAllocateScreen';
import BureauMyGuaranteesScreen from '../screens/bureau/BureauMyGuaranteesScreen';
import BureauTreasuryScreen from '../screens/bureau/BureauTreasuryScreen';
import BureauCyclesScreen from '../screens/bureau/BureauCyclesScreen';
import BureauCycleCreateScreen from '../screens/bureau/BureauCycleCreateScreen';
import BureauCycleDetailScreen from '../screens/bureau/BureauCycleDetailScreen';
import BureauTontineTypeFormScreen from '../screens/bureau/BureauTontineTypeFormScreen';
import BureauSessionsScreen from '../screens/bureau/BureauSessionsScreen';
import BureauSessionCreateScreen from '../screens/bureau/BureauSessionCreateScreen';
import BureauSessionDetailScreen from '../screens/bureau/BureauSessionDetailScreen';
import BureauPotDetailScreen from '../screens/bureau/BureauPotDetailScreen';
import BureauEventsScreen from '../screens/bureau/BureauEventsScreen';
import BureauEventFormScreen from '../screens/bureau/BureauEventFormScreen';
import BureauGovernanceScreen from '../screens/bureau/BureauGovernanceScreen';
import BureauAnnouncementFormScreen from '../screens/bureau/BureauAnnouncementFormScreen';
import BureauAnnouncementDetailScreen from '../screens/bureau/BureauAnnouncementDetailScreen';
import BureauDocumentDetailScreen from '../screens/bureau/BureauDocumentDetailScreen';
import BureauPollFormScreen from '../screens/bureau/BureauPollFormScreen';
import BureauPollDetailScreen from '../screens/bureau/BureauPollDetailScreen';
import BureauElectionFormScreen from '../screens/bureau/BureauElectionFormScreen';
import BureauElectionDetailScreen from '../screens/bureau/BureauElectionDetailScreen';
import BureauDocumentFormScreen from '../screens/bureau/BureauDocumentFormScreen';
import BureauSanctionsScreen from '../screens/bureau/BureauSanctionsScreen';
import BureauSanctionApplyScreen from '../screens/bureau/BureauSanctionApplyScreen';
import BureauSanctionCorrectScreen from '../screens/bureau/BureauSanctionCorrectScreen';
import BureauSanctionTypeFormScreen from '../screens/bureau/BureauSanctionTypeFormScreen';
import BureauWalletsScreen from '../screens/bureau/BureauWalletsScreen';
import BureauProxiesScreen from '../screens/bureau/BureauProxiesScreen';
import BureauBoardScreen from '../screens/bureau/BureauBoardScreen';
import BureauSettingsScreen from '../screens/bureau/BureauSettingsScreen';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';

const Stack = createNativeStackNavigator<BureauStackParamList>();

/** Shared native header style (aligned with AppStack detail screens). */
const header = {
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontWeight: font.bold },
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
} as const;

/** Espace bureau : dashboard + modules (gated en amont par isBureau). */
export default function BureauStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BureauDashboard"
        component={BureauDashboardScreen}
        options={{ title: 'Espace Bureau', ...header }}
      />
      <Stack.Screen name="BureauSearch" component={BureauSearchScreen} options={{ title: 'Rechercher', ...header }} />
      <Stack.Screen name="BureauOverview" component={BureauOverviewScreen} options={{ title: 'Tableau de bord', ...header }} />
      {/* Phase 2 — Membres */}
      <Stack.Screen name="BureauMembers" component={BureauMembersScreen} options={{ title: 'Membres', ...header }} />
      <Stack.Screen name="BureauMemberDetail" component={BureauMemberDetailScreen} options={{ title: 'Membre', ...header }} />
      <Stack.Screen name="BureauInvitationsOverview" component={BureauInvitationsOverviewScreen} options={{ title: 'Invitations', ...header }} />
      <Stack.Screen name="BureauInvitations" component={BureauInvitationsScreen} options={{ title: 'Inviter un membre', ...header }} />
      <Stack.Screen name="BureauFeesOverview" component={BureauFeesOverviewScreen} options={{ title: "Frais d'adhésion", ...header }} />
      <Stack.Screen name="BureauFeesConfig" component={BureauFeesConfigScreen} options={{ title: 'Configurer les frais', ...header }} />
      <Stack.Screen name="BureauImport" component={BureauImportScreen} options={{ title: 'Import de membres', ...header }} />
      {/* Phase 3 — Approbations */}
      <Stack.Screen name="BureauApprovals" component={BureauApprovalsScreen} options={{ title: 'Approbations', ...header }} />
      <Stack.Screen name="BureauApprovalDetail" component={BureauApprovalDetailScreen} options={{ title: 'Approbation', ...header }} />
      {/* Phase 4 — Finance */}
      <Stack.Screen name="BureauFinance" component={BureauFinanceScreen} options={{ title: 'Finance', ...header }} />
      <Stack.Screen name="BureauContributionDetail" component={BureauContributionDetailScreen} options={{ title: 'Cotisation', ...header }} />
      <Stack.Screen name="BureauLoanDetail" component={BureauLoanDetailScreen} options={{ title: 'Prêt', ...header }} />
      <Stack.Screen name="BureauLoanAllocate" component={BureauLoanAllocateScreen} options={{ title: 'Allocation des prêts', ...header }} />
      <Stack.Screen name="BureauMyGuarantees" component={BureauMyGuaranteesScreen} options={{ title: 'Mes garanties', ...header }} />
      <Stack.Screen name="BureauTreasury" component={BureauTreasuryScreen} options={{ title: 'Trésorerie', ...header }} />
      {/* Phase 5 — Cycles & séances */}
      <Stack.Screen name="BureauCycles" component={BureauCyclesScreen} options={{ title: 'Cycles & séances', ...header }} />
      <Stack.Screen name="BureauCycleCreate" component={BureauCycleCreateScreen} options={{ title: 'Nouveau cycle', ...header }} />
      <Stack.Screen name="BureauCycleDetail" component={BureauCycleDetailScreen} options={{ title: 'Cycle', ...header }} />
      <Stack.Screen name="BureauTontineTypeForm" component={BureauTontineTypeFormScreen} options={{ title: 'Type de cotisation', ...header }} />
      <Stack.Screen name="BureauSessions" component={BureauSessionsScreen} options={{ title: 'Séances', ...header }} />
      <Stack.Screen name="BureauSessionCreate" component={BureauSessionCreateScreen} options={{ title: 'Nouvelle séance', ...header }} />
      <Stack.Screen name="BureauSessionDetail" component={BureauSessionDetailScreen} options={{ title: 'Séance', ...header }} />
      <Stack.Screen name="BureauPotDetail" component={BureauPotDetailScreen} options={{ title: 'Cagnotte', ...header }} />
      {/* Phase 6 — Gouvernance */}
      <Stack.Screen name="BureauEvents" component={BureauEventsScreen} options={{ title: 'Événements', ...header }} />
      <Stack.Screen name="BureauEventForm" component={BureauEventFormScreen} options={{ title: 'Nouvel événement', ...header }} />
      <Stack.Screen name="BureauGovernance" component={BureauGovernanceScreen} options={{ title: 'Gouvernance', ...header }} />
      <Stack.Screen name="BureauAnnouncementForm" component={BureauAnnouncementFormScreen} options={{ title: 'Nouvelle annonce', ...header }} />
      <Stack.Screen name="BureauAnnouncementDetail" component={BureauAnnouncementDetailScreen} options={{ title: 'Annonce', ...header }} />
      <Stack.Screen name="BureauDocumentDetail" component={BureauDocumentDetailScreen} options={{ title: 'Document', ...header }} />
      <Stack.Screen name="BureauPollForm" component={BureauPollFormScreen} options={{ title: 'Nouveau sondage', ...header }} />
      <Stack.Screen name="BureauPollDetail" component={BureauPollDetailScreen} options={{ title: 'Sondage', ...header }} />
      <Stack.Screen name="BureauElectionForm" component={BureauElectionFormScreen} options={{ title: 'Nouvelle élection', ...header }} />
      <Stack.Screen name="BureauElectionDetail" component={BureauElectionDetailScreen} options={{ title: 'Élection', ...header }} />
      <Stack.Screen name="BureauDocumentForm" component={BureauDocumentFormScreen} options={{ title: 'Nouveau document', ...header }} />
      {/* Phase 7 — Sanctions, Wallets, Procurations */}
      <Stack.Screen name="BureauSanctions" component={BureauSanctionsScreen} options={{ title: 'Sanctions', ...header }} />
      <Stack.Screen name="BureauSanctionApply" component={BureauSanctionApplyScreen} options={{ title: 'Appliquer une sanction', ...header }} />
      <Stack.Screen name="BureauSanctionCorrect" component={BureauSanctionCorrectScreen} options={{ title: 'Corriger la sanction', ...header }} />
      <Stack.Screen name="BureauSanctionTypeForm" component={BureauSanctionTypeFormScreen} options={{ title: 'Type de sanction', ...header }} />
      <Stack.Screen name="BureauWallets" component={BureauWalletsScreen} options={{ title: 'Portefeuilles', ...header }} />
      <Stack.Screen name="BureauProxies" component={BureauProxiesScreen} options={{ title: 'Procurations', ...header }} />
      {/* Bureau (gouvernance) */}
      <Stack.Screen name="BureauBoard" component={BureauBoardScreen} options={{ title: 'Bureau', ...header }} />
      {/* Phase 8 — Paramètres */}
      <Stack.Screen name="BureauSettings" component={BureauSettingsScreen} options={{ title: 'Paramètres du bureau', ...header }} />
    </Stack.Navigator>
  );
}
