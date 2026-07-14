import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
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
import { useAppStore } from '../../lib/stores/app-store';
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
  /** Route du stack parent (AppStack) — pour réutiliser le chat existant. */
  parent?: string;
  badgeKey?: 'requests' | 'approvals';
};

const MODULES: ModuleDef[] = [
  { key: 'overview', icon: 'grid', label: 'Tableau de bord', desc: 'Vision globale de la tontine', tint: 'primary', route: 'BureauOverview' },
  { key: 'members', icon: 'people', label: 'Membres', desc: 'Adhésions, démissions, frais', tint: 'lime', route: 'BureauMembers', badgeKey: 'requests' },
  { key: 'board', icon: 'ribbon', label: 'Bureau', desc: 'Responsables & mandats', tint: 'accent', route: 'BureauBoard' },
  { key: 'approvals', icon: 'checkmark-done-circle', label: 'Approbations', desc: 'Valider les actions sensibles', tint: 'primary', route: 'BureauApprovals', badgeKey: 'approvals' },
  { key: 'finance', icon: 'cash', label: 'Finance', desc: 'Cotisations, prêts, trésorerie', tint: 'accent', route: 'BureauFinance' },
  { key: 'invitations', icon: 'mail', label: 'Invitations', desc: 'Suivi & onboarding', tint: 'info', route: 'BureauInvitationsOverview' },
  { key: 'sessions', icon: 'calendar', label: 'Séances', desc: 'Réunions, présences, PV', tint: 'lime', route: 'BureauSessions' },
  { key: 'calendar', icon: 'calendar-number', label: 'Calendrier', desc: 'Événements & AG', tint: 'info', route: 'BureauEvents' },
  { key: 'cycles', icon: 'reload-circle', label: 'Cycles', desc: 'Cycles & cagnottes', tint: 'primary', route: 'BureauCycles' },
  { key: 'governance', icon: 'podium', label: 'Gouvernance', desc: 'Annonces, sondages, élections', tint: 'info', route: 'BureauGovernance' },
  { key: 'sanctions', icon: 'warning', label: 'Sanctions', desc: 'Appliquer & gérer', tint: 'danger', route: 'BureauSanctions' },
  { key: 'treasury', icon: 'wallet', label: 'Portefeuilles', desc: 'Soldes & ajustements', tint: 'lime', route: 'BureauWallets' },
  { key: 'proxies', icon: 'people', label: 'Procurations', desc: 'Valider les mandats', tint: 'primary', route: 'BureauProxies' },
  { key: 'settings', icon: 'briefcase', label: 'Paramètres', desc: 'Rôles, règles, prêts', tint: 'accent', route: 'BureauSettings' },
  { key: 'chat', icon: 'chatbubbles', label: 'Discussion', desc: 'Échanges du bureau', tint: 'info', parent: 'Chat' },
];

export default function BureauDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const assoc = useAuthStore((s) => s.activeAssociation);
  const { isPresident } = usePermissions();
  const tutoDismissed = useAppStore((s) => s.presidentTutoDismissed);
  const dismissTuto = useAppStore((s) => s.dismissPresidentTuto);
  const showTuto = isPresident && !!assoc && !tutoDismissed.includes(assoc.slug);

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
          colors={[colors.primary, colors.green[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.badge}>
            <Ionicons name="ribbon" size={11} color={colors.primary} />
            <Text style={styles.badgeText}>BUREAU</Text>
          </View>
          <Text style={styles.welcome}>Bonjour {user?.first_name ?? ''}</Text>
          <Text style={styles.welcomeSub}>
            {assoc?.name ? `${assoc.name} — ` : ''}gérez votre tontine depuis cet espace.
          </Text>
        </LinearGradient>

        {/* Tuto de démarrage — nouveau président */}
        {showTuto ? (
          <View style={styles.tutoCard}>
            <View style={styles.tutoHead}>
              <View style={styles.flex}>
                <Text style={styles.tutoTitle}>Bienvenue président·e ! </Text>
                <Text style={styles.tutoSub}>Pour démarrer votre association, voici les étapes recommandées :</Text>
              </View>
              <Pressable onPress={() => assoc && dismissTuto(assoc.slug)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <TutoStep n={1} icon="settings-outline" title="Configurer l'association" desc="Devise, message de bienvenue, règles wallet/procurations" onPress={() => navigation.navigate('BureauSettings')} />
            <TutoStep n={2} icon="layers-outline" title="Créer le 1er type de tontine" desc="Définir le mode de cotisation, le montant, etc." onPress={() => navigation.navigate('BureauTontineTypeForm')} />
            <TutoStep n={3} icon="calendar-outline" title="Démarrer un cycle" desc="Période d'activité (généralement 1 an)" onPress={() => navigation.navigate('BureauCycleCreate')} />
            <TutoStep n={4} icon="person-add-outline" title="Inviter les premiers membres" desc="Envoi par email, SMS ou lien" onPress={() => navigation.navigate('BureauMembers')} />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Modules</Text>

        <View style={styles.grid}>
          {MODULES.map((m) => (
            <ModuleTile
              key={m.key}
              icon={m.icon}
              label={m.label}
              desc={m.desc}
              tint="primary"
              disabled={!m.route && !m.parent}
              badge={m.badgeKey ? badges[m.badgeKey] : undefined}
              onPress={
                m.parent
                  ? () => navigation.getParent()?.navigate(m.parent as any)
                  : m.route
                    ? () => navigation.navigate(m.route as any)
                    : undefined
              }
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

function TutoStep({ n, icon, title, desc, onPress }: { n: number; icon: IoniconName; title: string; desc: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tutoStep} onPress={onPress}>
      <View style={styles.tutoStepIcon}><Ionicons name={icon} size={16} color={colors.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.tutoStepTitle}>{n}. {title}</Text>
        <Text style={styles.tutoStepDesc}>{desc}</Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color={colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  hero: { 
    borderRadius: radius.hero, 
    padding: 24, 
    gap: 8, 
    backgroundColor: colors.primary, 
    ...cardShadow 
  },

  tutoCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.greenBgDeep, ...cardShadow },
  tutoHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tutoTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  tutoSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
  tutoStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.sm },
  tutoStepIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tutoStepTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  tutoStepDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 10, color: colors.primary, fontWeight: font.bold, letterSpacing: 0.5 },
  welcome: { 
    color: colors.white, 
    fontSize: 24, 
    fontWeight: font.bold, 
    lineHeight: 30, 
    marginTop: 4 
  },
  welcomeSub: { 
    color: 'rgba(255, 255, 255, 0.85)', 
    fontSize: font.size.sm, 
    lineHeight: 18, 
    marginTop: 2 
  },
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
