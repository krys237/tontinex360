import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import ProxyRequestModal from '../../components/governance/ProxyRequestModal';
import { proxiesApi, type Proxy, type ProxyStatus } from '../../lib/api/proxies';
import { useAuthStore } from '../../lib/stores/auth-store';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function frDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr ?? '';
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

const WORKFLOW: { icon: IoniconName; title: string }[] = [
  { icon: 'paper-plane-outline', title: 'Création' },
  { icon: 'shield-checkmark-outline', title: 'Validation' },
  { icon: 'person-add-outline', title: 'Délégation' },
  { icon: 'checkmark-circle-outline', title: 'Consommée' },
];

const STATUS: Record<ProxyStatus, { label: string; bg: string; fg: string; icon: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: colors.goldAccent, icon: 'time-outline' },
  approved: { label: 'Approuvée', bg: colors.greenBg, fg: colors.primary, icon: 'checkmark-circle-outline' },
  rejected: { label: 'Refusée', bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle-outline' },
  used: { label: 'Consommée', bg: colors.tintBlueBg, fg: colors.info, icon: 'checkbox-outline' },
  cancelled: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted, icon: 'ban-outline' },
};

type TabKey = 'mine' | 'received';

export default function ProxiesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const [tab, setTab] = useState<TabKey>('mine');
  const [modalOpen, setModalOpen] = useState(false);

  const proxiesQ = useQuery({ queryKey: ['proxies'], queryFn: () => proxiesApi.list() });
  const all = proxiesQ.data ?? [];

  const mine = useMemo(() => all.filter((p) => !myId || p.grantor === myId), [all, myId]);
  const received = useMemo(() => all.filter((p) => p.proxy === myId), [all, myId]);
  const list = tab === 'mine' ? mine : received;

  const count = (s: ProxyStatus | ProxyStatus[]) => {
    const set = Array.isArray(s) ? s : [s];
    return mine.filter((p) => p.status && set.includes(p.status)).length;
  };

  const onCreated = () => qc.invalidateQueries({ queryKey: ['proxies'] });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.x3 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={proxiesQ.isRefetching} onRefresh={() => proxiesQ.refetch()} tintColor={colors.primary} />
        }>
        
        {/* Header Heading */}
        <View>
          <Text style={styles.overline}>Communauté</Text>
          <Text style={styles.pageTitle}>Procurations & Délégations</Text>
          <Text style={styles.pageSub}>
            Gérez vos délégations de présence et de versement lors des séances de l'association.
          </Text>
        </View>

        {/* Hero Banner Card */}
        <LinearGradient
          colors={[colors.primary, colors.green[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>Mandater un représentant</Text>
            <Text style={styles.heroSub}>
              Créez une procuration officielle pour permettre à un autre membre de vous représenter ou de collecter en séance.
            </Text>
          </View>

          <Pressable
            onPress={() => setModalOpen(true)}
            style={({ pressed }) => [styles.heroBtnWhite, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.heroBtnWhiteText}>Créer une procuration</Text>
          </Pressable>
        </LinearGradient>

        {/* Bilan Procurations Stats Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Mon bilan des procurations</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{count('approved')}</Text>
              <Text style={styles.statLabel}>Actives</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.goldAccent }]}>{count('pending')}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.info }]}>{count('used')}</Text>
              <Text style={styles.statLabel}>Consommées</Text>
            </View>
          </View>
        </Card>

        {/* Horizontal Workflow Stepper */}
        <Card style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Workflow de validation</Text>
          <View style={styles.stepperContainer}>
            {WORKFLOW.map((step, i) => (
              <React.Fragment key={step.title}>
                <View style={styles.stepDotContainer}>
                  <View style={styles.stepDotIcon}>
                    <Ionicons name={step.icon} size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.stepDotLabel}>{step.title}</Text>
                </View>
                {i < WORKFLOW.length - 1 && (
                  <View style={styles.stepLine} />
                )}
              </React.Fragment>
            ))}
          </View>
        </Card>

        {/* Tabs Control */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => setTab('mine')}
            style={[styles.tabBtn, tab === 'mine' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
              Mes demandes ({mine.length})
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => setTab('received')}
            style={[styles.tabBtn, tab === 'received' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>
              Reçues ({received.length})
            </Text>
          </Pressable>
        </View>

        {/* List of Proxies */}
        {list.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={colors.textLight} />
            <Text style={styles.empty}>Aucune procuration dans cette catégorie.</Text>
          </Card>
        ) : (
          list.map((p) => <ProxyItem key={p.id} proxy={p} tab={tab} />)
        )}
      </ScrollView>

      <ProxyRequestModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        currentMembershipId={myId}
        onCreated={onCreated}
      />
    </View>
  );
}

function ProxyItem({ proxy, tab }: { proxy: Proxy; tab: TabKey }) {
  const st = (proxy.status && STATUS[proxy.status]) || STATUS.pending;
  const counterpart =
    tab === 'mine'
      ? proxy.proxy_name ?? 'Membre mandaté'
      : proxy.grantor_name ?? 'Membre mandant';
  
  const sessionLabel = [
    proxy.session_number != null ? `Séance N°${proxy.session_number}` : null,
    frDate(proxy.session_date),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHead}>
        <View style={[styles.itemBubble, { borderColor: st.fg }]}>
          <Ionicons name={st.icon as any} size={20} color={st.fg} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.itemName} numberOfLines={1}>
            {tab === 'mine' ? `Mandat à : ${counterpart}` : `Reçu de : ${counterpart}`}
          </Text>
          {sessionLabel ? <Text style={styles.itemMeta} numberOfLines={1}>{sessionLabel}</Text> : null}
          {proxy.tontine_name ? (
            <Text style={styles.itemTontine}>Tontine : {proxy.tontine_name}</Text>
          ) : null}
        </View>
        <View style={styles.rightCol}>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      {proxy.reason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.itemReason} numberOfLines={2}>« {proxy.reason} »</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x3 },
  pressed: { opacity: 0.85 },

  overline: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  pageTitle: { fontSize: font.size.x2, fontWeight: font.extrabold, color: colors.text, marginTop: 2, letterSpacing: -0.3 },
  pageSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4, lineHeight: font.size.sm * 1.4 },

  // Hero Card
  hero: { borderRadius: radius.hero, padding: 20, ...cardShadow },
  heroInfo: { gap: 6 },
  heroTitle: { color: colors.white, fontSize: font.size.lg, fontWeight: font.bold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.sm, lineHeight: 18 },
  heroBtnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 44,
    marginTop: spacing.md,
    ...cardShadow,
  },
  heroBtnWhiteText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.sm },

  // Summary Card
  summaryCard: { borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  summaryCardTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: font.size.xl, fontWeight: font.extrabold, color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt },

  // Workflow Stepper
  workflowCard: { borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  workflowTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, marginBottom: spacing.md },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  stepDotContainer: { alignItems: 'center', zIndex: 2 },
  stepDotIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotLabel: { fontSize: 8, fontWeight: font.bold, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  stepLine: { height: 1, flex: 1, backgroundColor: colors.border, marginTop: -14, zIndex: 1, marginHorizontal: -4 },

  // Tabs segmented control
  tabsRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginVertical: spacing.xs },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.white, ...cardShadow },
  tabText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.medium },
  tabTextActive: { color: colors.primary, fontWeight: font.bold },

  // List Items
  emptyCard: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.x3, gap: spacing.sm, ...cardShadow },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  itemCard: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...cardShadow },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemBubble: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.white, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 2,
  },
  itemName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  itemMeta: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.medium, marginTop: 4 },
  itemTontine: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: font.bold },
  rightCol: { alignItems: 'flex-end' },
  reasonBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: 8, marginTop: 10 },
  itemReason: { fontSize: font.size.xs, color: colors.text, fontStyle: 'italic' },
});
