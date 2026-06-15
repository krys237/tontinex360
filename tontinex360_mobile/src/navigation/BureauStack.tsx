import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BureauStackParamList } from './types';
import BureauDashboardScreen from '../screens/bureau/BureauDashboardScreen';
import BureauMembersScreen from '../screens/bureau/BureauMembersScreen';
import BureauMemberDetailScreen from '../screens/bureau/BureauMemberDetailScreen';
import BureauInvitationsScreen from '../screens/bureau/BureauInvitationsScreen';
import BureauApprovalsScreen from '../screens/bureau/BureauApprovalsScreen';
import BureauApprovalDetailScreen from '../screens/bureau/BureauApprovalDetailScreen';
import BureauFinanceScreen from '../screens/bureau/BureauFinanceScreen';
import BureauContributionDetailScreen from '../screens/bureau/BureauContributionDetailScreen';
import BureauLoanDetailScreen from '../screens/bureau/BureauLoanDetailScreen';
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
      {/* Phase 2 — Membres */}
      <Stack.Screen name="BureauMembers" component={BureauMembersScreen} options={{ title: 'Membres', ...header }} />
      <Stack.Screen name="BureauMemberDetail" component={BureauMemberDetailScreen} options={{ title: 'Membre', ...header }} />
      <Stack.Screen name="BureauInvitations" component={BureauInvitationsScreen} options={{ title: 'Invitations', ...header }} />
      {/* Phase 3 — Approbations */}
      <Stack.Screen name="BureauApprovals" component={BureauApprovalsScreen} options={{ title: 'Approbations', ...header }} />
      <Stack.Screen name="BureauApprovalDetail" component={BureauApprovalDetailScreen} options={{ title: 'Approbation', ...header }} />
      {/* Phase 4 — Finance */}
      <Stack.Screen name="BureauFinance" component={BureauFinanceScreen} options={{ title: 'Finance', ...header }} />
      <Stack.Screen name="BureauContributionDetail" component={BureauContributionDetailScreen} options={{ title: 'Cotisation', ...header }} />
      <Stack.Screen name="BureauLoanDetail" component={BureauLoanDetailScreen} options={{ title: 'Prêt', ...header }} />
    </Stack.Navigator>
  );
}
