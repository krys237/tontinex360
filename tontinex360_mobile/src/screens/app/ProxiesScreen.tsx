import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
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

const WORKFLOW: { icon: IoniconName; title: string; desc: string }[] = [
  { icon: 'paper-plane-outline', title: 'Création', desc: 'Le membre principal crée la procuration officielle.' },
  { icon: 'shield-checkmark-outline', title: 'Validation', desc: 'Le bureau vérifie et approuve la délégation.' },
  { icon: 'person-add-outline', title: 'Représentation', desc: 'Le proxy collecte et représente pendant la séance.' },
  { icon: 'checkmark-circle-outline', title: 'Consommée', desc: 'La procuration est utilisée automatiquement.' },
];

const STATUS: Record<ProxyStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: colors.goldAccent },
  approved: { label: 'Approuvée', bg: colors.greenBg, fg: colors.primary },
  rejected: { label: 'Refusée', bg: colors.dangerSoft, fg: colors.danger },
  used: { label: 'Consommée', bg: colors.tintBlueBg, fg: colors.info },
  cancelled: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted },
};

type TabKey = 'mine' | 'received';

export default function ProxiesScreen() {
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const [tab, setTab] = useState<TabKey>('mine');
  const [modalOpen, setModalOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);

  const proxiesQ = useQuery({ queryKey: ['proxies'], queryFn: () => proxiesApi.list() });
  const all = proxiesQ.data ?? [];

  const mine = useMemo(() => all.filter((p) => !myId || p.grantor === myId), [all, myId]);
  const received = useMemo(() => all.filter((p) => p.proxy === myId), [all, myId]);
  const list = tab === 'mine' ? mine : received;

  const count = (s: ProxyStatus | ProxyStatus[]) => {
    const set = Array.isArray(s) ? s : [s];
    return mine.filter((p) => p.status && set.includes(p.status)).length;
  };
  const summary = [
    { label: 'Procurations actives', value: count('approved') },
    { label: 'En attente validation', value: count('pending') },
    { label: 'Approuvées', value: count(['approved', 'used']) },
    { label: 'Refusées', value: count('rejected') },
  ];

  const onCreated = () => qc.invalidateQueries({ queryKey: ['proxies'] });
  const goToList = () => scrollRef.current?.scrollTo({ y: Math.max(0, listY.current - 8), animated: true });

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={proxiesQ.isRefetching} onRefresh={() => proxiesQ.refetch()} tintColor={colors.primary} />
        }>
        {/* Section heading */}
        <View>
          <Text style={styles.overline}>Communauté</Text>
          <Text style={styles.pageTitle}>Procurations & Délégations</Text>
          <Text style={styles.pageSub}>
            Gérez les représentations officielles, validations du bureau et délégations de collecte
            pendant les séances.
          </Text>
        </View>

        {/* Hero */}
        <LinearGradient
          colors={[colors.green[800], colors.green[500]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroTitle}>Sécurisez les délégations de présence</Text>
          <Text style={styles.heroSub}>
            Validation des procurations, contrôle des représentants et gestion des documents officiels
            en temps réel.
          </Text>

          <Pressable
            onPress={() => setModalOpen(true)}
            style={({ pressed }) => [styles.heroBtnWhite, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.heroBtnWhiteText}>Créer une procuration</Text>
          </Pressable>

          <Pressable
            onPress={goToList}
            style={({ pressed }) => [styles.heroBtnGhost, pressed && styles.pressed]}>
            <Text style={styles.heroBtnGhostText}>Voir les validations</Text>
          </Pressable>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>RÉSUMÉ PROCURATIONS</Text>
            <View style={styles.summaryGrid}>
              {summary.map((it) => (
                <View key={it.label} style={styles.summaryItem}>
                  <Text style={styles.summaryLabel} numberOfLines={1}>
                    {it.label}
                  </Text>
                  <Text style={styles.summaryValue}>{it.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Workflow */}
        <Card style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Workflow des Procurations</Text>
          <Text style={styles.workflowSub}>Cycle complet de validation et de consommation.</Text>
          {WORKFLOW.map((step, i) => (
            <View key={step.title} style={[styles.step, i > 0 && styles.stepGap]}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </Card>

        {/* Tabs + create */}
        <View onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('mine')} style={styles.tab}>
              <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>Mes procurations</Text>
              {tab === 'mine' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
            <Pressable onPress={() => setTab('received')} style={styles.tab}>
              <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>Reçues</Text>
              {tab === 'received' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          </View>

          <Pressable
            onPress={() => setModalOpen(true)}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.newBtnText}>Nouvelle procuration</Text>
          </Pressable>

          {/* List */}
          {list.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.empty}>Aucune procuration.</Text>
            </Card>
          ) : (
            list.map((p) => <ProxyItem key={p.id} proxy={p} tab={tab} />)
          )}
        </View>
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
        <View style={styles.itemBubble}>
          <Ionicons name="people-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.itemName} numberOfLines={1}>
            {tab === 'mine' ? `Délégué à ${counterpart}` : `Reçue de ${counterpart}`}
          </Text>
          {sessionLabel ? <Text style={styles.itemMeta} numberOfLines={1}>{sessionLabel}</Text> : null}
        </View>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>
      {proxy.tontine_name ? <Text style={styles.itemExtra}>Tontine : {proxy.tontine_name}</Text> : null}
      {proxy.reason ? <Text style={styles.itemReason} numberOfLines={2}>« {proxy.reason} »</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x3 },
  pressed: { opacity: 0.85 },

  overline: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  pageTitle: { fontSize: font.size.x2, fontWeight: font.extrabold, color: colors.text, marginTop: 2, letterSpacing: -0.3 },
  pageSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 6, lineHeight: font.size.sm * 1.45 },

  // Hero
  hero: { borderRadius: radius.hero, padding: spacing.x2, ...cardShadow },
  heroTitle: { color: colors.white, fontSize: font.size.xl, fontWeight: font.extrabold, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: font.size.sm, marginTop: 8, lineHeight: font.size.sm * 1.45 },
  heroBtnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    minHeight: 48,
    marginTop: spacing.lg,
  },
  heroBtnWhiteText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.md },
  heroBtnGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    minHeight: 44,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBtnGhostText: { color: colors.white, fontWeight: font.semibold, fontSize: font.size.sm },

  summary: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryTitle: { color: 'rgba(255,255,255,0.8)', fontSize: font.size.xs, fontWeight: font.semibold, letterSpacing: 0.6, marginBottom: spacing.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  summaryItem: { width: '50%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: spacing.md },
  summaryLabel: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: font.size.sm },
  summaryValue: { color: colors.white, fontSize: font.size.lg, fontWeight: font.bold, marginLeft: 8 },

  // Workflow
  workflowCard: { borderRadius: radius.card, padding: spacing.xl },
  workflowTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  workflowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  step: {
    backgroundColor: colors.green[50],
    borderWidth: 1,
    borderColor: colors.tintGreenBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  stepGap: { marginTop: spacing.md },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.tintGreenBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  stepDesc: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: font.size.sm * 1.4 },

  // Tabs
  tabs: { flexDirection: 'row', gap: spacing.x2, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.lg },
  tab: { paddingVertical: spacing.sm },
  tabText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  tabTextActive: { color: colors.text },
  tabUnderline: { height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: spacing.sm },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 50,
    marginBottom: spacing.lg,
  },
  newBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.md },

  // List
  emptyCard: { borderRadius: radius.card, alignItems: 'center', paddingVertical: spacing.x2 },
  empty: { fontSize: font.size.sm, color: colors.textMuted },

  itemCard: { borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemBubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  itemMeta: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },
  itemExtra: { fontSize: font.size.sm, color: colors.textMuted, marginTop: spacing.md },
  itemReason: { fontSize: font.size.sm, color: colors.text, fontStyle: 'italic', marginTop: 6 },
});
