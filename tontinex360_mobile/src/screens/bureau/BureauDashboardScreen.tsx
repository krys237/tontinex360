import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ModuleTile from '../../components/bureau/ModuleTile';
import type { BureauStackParamList } from '../../navigation/types';
import type { BubbleTint } from '../../components/ui/IconBubble';
import { membersApi } from '../../lib/api/members';
import { approvalsApi } from '../../lib/api/approvals';
import { useAuthStore } from '../../lib/stores/auth-store';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauDashboard'>;

type ModuleDef = {
  key: string;
  icon: IoniconName;
  label: string;
  desc: string;
  tint: BubbleTint;
  route?: keyof BureauStackParamList;
  badgeKey?: 'requests' | 'approvals';
};

const MODULES: ModuleDef[] = [
  { key: 'members', icon: 'people', label: 'Membres', desc: 'Adhésions, démissions, bureau', tint: 'lime', route: 'BureauMembers', badgeKey: 'requests' },
  { key: 'approvals', icon: 'checkmark-done-circle', label: 'Approbations', desc: 'Valider les actions sensibles', tint: 'primary', route: 'BureauApprovals', badgeKey: 'approvals' },
  { key: 'finance', icon: 'cash', label: 'Finance', desc: 'Cotisations, prêts, trésorerie', tint: 'accent', route: 'BureauFinance' },
  { key: 'invitations', icon: 'mail', label: 'Invitations', desc: 'Inviter de nouveaux membres', tint: 'info', route: 'BureauInvitations' },
  // Modules à venir (phases suivantes)
  { key: 'cycles', icon: 'reload-circle', label: 'Cycles', desc: 'Cycles & séances', tint: 'primary' },
  { key: 'governance', icon: 'podium', label: 'Gouvernance', desc: 'Élections & sondages', tint: 'info' },
  { key: 'sanctions', icon: 'warning', label: 'Sanctions', desc: 'Appliquer & gérer', tint: 'danger' },
  { key: 'treasury', icon: 'wallet', label: 'Trésorerie', desc: 'Comptes & soldes', tint: 'lime' },
  { key: 'settings', icon: 'briefcase', label: 'Paramètres', desc: 'Rôles & règles bureau', tint: 'accent' },
];

export default function BureauDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const assoc = useAuthStore((s) => s.activeAssociation);
  const { isPresident } = usePermissions();

  // Compteurs de badges (best-effort : on ignore les erreurs 403).
  const requestsQ = useQuery({
    queryKey: ['bureau', 'membership-requests', 'pending'],
    queryFn: () => membersApi.membershipRequests({ status: 'pending' }),
    retry: false,
  });
  const approvalsQ = useQuery({
    queryKey: ['bureau', 'approvals', 'pending'],
    queryFn: () => approvalsApi.list({ status: 'pending' }),
    retry: false,
  });

  const badges = {
    requests: requestsQ.data?.length ?? 0,
    approvals: approvalsQ.data?.length ?? 0,
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.badge}>
            <Ionicons name="ribbon" size={11} color={colors.white} />
            <Text style={styles.badgeText}>BUREAU</Text>
          </View>
          <Text style={styles.welcome}>Bonjour {user?.first_name ?? ''} 👋</Text>
          <Text style={styles.welcomeSub}>
            {assoc?.name ? `${assoc.name} — ` : ''}gérez votre tontine depuis cet espace.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Modules</Text>

        <View style={styles.grid}>
          {MODULES.map((m) => (
            <ModuleTile
              key={m.key}
              icon={m.icon}
              label={m.label}
              desc={m.desc}
              tint={m.tint}
              disabled={!m.route}
              badge={m.badgeKey ? badges[m.badgeKey] : undefined}
              onPress={m.route ? () => navigation.navigate(m.route as any) : undefined}
            />
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.noteText}>
            {isPresident
              ? 'En tant que président, vous validez les actions sensibles (prêts, sanctions, clôtures).'
              : 'Cet espace est réservé aux membres du bureau. Certaines actions nécessitent une validation.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: 4, ...cardShadow },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 10, color: colors.white, fontWeight: font.bold, letterSpacing: 0.5 },
  welcome: { color: colors.white, fontSize: font.size.xl, fontWeight: font.bold, marginTop: 6 },
  welcomeSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.sm },
  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E0F2FE',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { fontSize: font.size.sm, color: colors.info, flex: 1 },
});
