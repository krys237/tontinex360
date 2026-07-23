import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ViewStyle,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Card, SectionHeader, IconBubble } from '../../components/ui';
import LoanRequestModal from '../../components/finance/LoanRequestModal';
import ProxyRequestModal from '../../components/governance/ProxyRequestModal';
import { walletsApi } from '../../lib/api/wallets';
import { notificationsApi } from '../../lib/api/notifications';
import { financeApi } from '../../lib/api/finance';
import { cyclesApi } from '../../lib/api/cycles';
import { tontinesApi } from '../../lib/api/tontines';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import type { AppTabsParamList, AppStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, 'Accueil'>,
  NativeStackNavigationProp<AppStackParamList>
>;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2026-06-19" -> "19 juin". Safe parse, returns '' if invalid. */
function formatDayMonth(dateStr?: string | null): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return '';
  const day = Number(m[3]);
  const month = MONTHS_FR[Number(m[2]) - 1] ?? '';
  return `${day} ${month}`;
}

/** 0 -> "+0 XAF", -2000 -> "-2 000 XAF". */
function formatSignedXAF(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  const sign = n < 0 ? '-' : '+';
  return `${sign}${formatNumber(Math.abs(n))} XAF`;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const association = useAuthStore((s) => s.activeAssociation);
  const membership = useAuthStore((s) => s.currentMembership);

  const [loanOpen, setLoanOpen] = useState(false);
  const [proxyOpen, setProxyOpen] = useState(false);

  const walletQ = useQuery({ queryKey: ['wallet', 'me'], queryFn: walletsApi.myWallet });
  const unreadQ = useQuery({ queryKey: ['notifications', 'unread'], queryFn: notificationsApi.unreadCount });
  // ⚠ Filtre membership indispensable : sans lui le serveur renvoie les
  // cotisations de TOUTE l'association et le compteur « en retard » de
  // l'accueil comptait les impayés des autres membres.
  const contribQ = useQuery({
    queryKey: ['contributions', 'mine', membership?.id ?? null],
    queryFn: () => financeApi.contributions(membership ? { membership: membership.id } : undefined),
    enabled: !!membership,
  });
  const activityQ = useQuery({ queryKey: ['notifications', 'recent'], queryFn: () => notificationsApi.list() });
  const cycleQ = useQuery({ queryKey: ['cycle', 'current'], queryFn: cyclesApi.current });
  const subsQ = useQuery({ queryKey: ['tontines', 'subs'], queryFn: () => tontinesApi.subscriptions() });
  const entriesQ = useQuery({ queryKey: ['wallet', 'entries'], queryFn: () => walletsApi.myEntries() });

  const cycle = cycleQ.data ?? null;
  const sessionsQ = useQuery({
    queryKey: ['cycle', 'sessions', cycle?.id ?? null],
    queryFn: () => cyclesApi.sessions({ status: 'scheduled', ...(cycle ? { cycle: cycle.id } : {}) }),
    enabled: !!cycle,
  });

  const refreshing =
    walletQ.isRefetching ||
    unreadQ.isRefetching ||
    subsQ.isRefetching ||
    entriesQ.isRefetching ||
    sessionsQ.isRefetching ||
    activityQ.isRefetching;

  const onRefresh = () => {
    walletQ.refetch();
    unreadQ.refetch();
    contribQ.refetch();
    activityQ.refetch();
    cycleQ.refetch();
    subsQ.refetch();
    entriesQ.refetch();
    sessionsQ.refetch();
  };

  // --- Derived data ---
  const contributions = contribQ.data ?? [];
  const lateCount = contributions.filter((c) => c.status === 'defaulted').length;

  const balance = walletQ.data?.balance ?? 0;

  const mySubs = (subsQ.data ?? []).filter(
    (s) => (!membership || s.membership === membership.id) && (!cycle || s.cycle === cycle.id),
  );
  const subsCount = mySubs.length;

  // Versements reçus = crédits portés au portefeuille (gains, redistributions…).
  // À affiner quand l'endpoint « payouts » dédié sera disponible.
  const entries = entriesQ.data ?? [];
  const receivedCount = entries.filter((e) => e.direction === 'credit').length;

  // Prochaine séance : la plus proche séance planifiée à venir (date >= aujourd'hui),
  // sinon la plus proche disponible. Données réelles via cyclesApi.sessions.
  const todayISO = new Date().toISOString().slice(0, 10);
  const scheduled = [...(sessionsQ.data ?? [])]
    .filter((s) => !!s.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextSession = scheduled.find((s) => s.date >= todayISO) ?? scheduled[0];

  const sessionsLoading = cycleQ.isLoading || (!!cycle && sessionsQ.isLoading);
  const nextSessionLabel = sessionsLoading
    ? 'Chargement…'
    : nextSession
      ? `N°${nextSession.session_number} · ${formatDayMonth(nextSession.date)}${nextSession.location ? ` · ${nextSession.location}` : ''
      }`
      : 'Aucune séance programmée';

  const recent = (activityQ.data ?? []).slice(0, 3);

  const firstName = user?.first_name ?? '';
  const initials =
    `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || 'TX';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {/* ---------- Top bar ---------- */}
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Profil')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>

          <View style={styles.topbarTitle}>
            <Text style={styles.topbarHello} numberOfLines={1}>
              Bonjour {firstName}
            </Text>
            <Text style={styles.topbarAssoc} numberOfLines={1}>
              {association?.name ?? 'TontineX360'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Notifications')}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.pressed]}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {!!unreadQ.data && unreadQ.data > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadQ.data > 99 ? '99+' : unreadQ.data}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ---------- Hero ---------- */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroTitle}>Mon espace membre</Text>
          <Text style={styles.heroSub}>
            Retrouvez vos tontines, votre portefeuille et vos versements en un coup d'œil.
          </Text>

          <View style={styles.sessionPill}>
            <View style={styles.sessionIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sessionLabel}>Prochaine séance</Text>
              <Text style={styles.sessionValue} numberOfLines={1}>
                {nextSessionLabel}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ---------- Late-payment alert (kept from previous dashboard) ---------- */}
        {lateCount > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('Regulariser')}
            style={({ pressed }) => [styles.alert, pressed && styles.pressed]}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.alertText}>
              {lateCount} cotisation{lateCount > 1 ? 's' : ''} en retard · régularisez votre situation
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
          </Pressable>
        ) : null}

        {/* ---------- Quick actions ---------- */}
        <View style={styles.sectionContainer}>
          <SectionHeader title="Actions rapides" />
          <View style={styles.actionsGrid}>
            <ActionButton
              label="Souscrire à une tontine"
              icon="albums-outline"
              illustration={require('../../assets/illustrations/piggy-bank.png')}
              onPress={() => navigation.navigate('MesTontines')}
            />
            <ActionButton
              label="Demander un prêt"
              icon="cash-outline"
              illustration={require('../../assets/illustrations/icone-tontine.png')}
              onPress={() => setLoanOpen(true)}
            />
            <ActionButton
              label="Donner procuration"
              icon="document-outline"
              illustration={require('../../assets/illustrations/documents.png')}
              onPress={() => setProxyOpen(true)}
            />
            <ActionButton
              label="Voter aux sondages"
              icon="checkmark-circle-outline"
              illustration={require('../../assets/illustrations/ballot-box.png')}
              onPress={() => navigation.navigate('Communaute')}
            />
          </View>
        </View>

        {/* ---------- Stat cards ---------- */}
        <View style={styles.sectionContainer}>
          <SectionHeader title="Mon bilan" />
          <InfoCard
            label="Mon portefeuille"
            value={formatSignedXAF(balance)}
            valueTint="primary"
            icon="wallet-outline"
            onPress={() => navigation.navigate('Finances')}
          />

          <InfoCard
            label="Mes tontines"
            value={String(subsCount)}
            icon="albums-outline"
            onPress={() => navigation.navigate('MesTontines')}
          />

          <InfoCard
            label="Versements reçus"
            value={String(receivedCount)}
            icon="swap-horizontal-outline"
            onPress={() => navigation.navigate('Finances')}
          />
        </View>

        {/* ---------- Recent activity (kept from previous dashboard) ---------- */}
        <Card style={styles.activityCard}>
          <SectionHeader
            title="Activité récente"
            action="Voir"
            onAction={() => navigation.navigate('Notifications')}
          />
          {recent.length === 0 ? (
            <Text style={styles.empty}>Aucune activité récente.</Text>
          ) : (
            recent.map((n, i) => (
              <View key={n.id} style={[styles.activityRow, i > 0 && styles.activityDivider]}>
                <IconBubble icon={n.is_read ? 'notifications-outline' : 'notifications'} tint="white" size={32} />
                <View style={styles.flex}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {n.title}
                  </Text>
                  {n.body ? (
                    <Text style={styles.activityBody} numberOfLines={1}>
                      {n.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <LoanRequestModal
        visible={loanOpen}
        onClose={() => setLoanOpen(false)}
        membershipId={membership?.id}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['loans'] });
          qc.invalidateQueries({ queryKey: ['wallet', 'me'] });
        }}
      />

      <ProxyRequestModal
        visible={proxyOpen}
        onClose={() => setProxyOpen(false)}
        currentMembershipId={membership?.id}
        onCreated={() => qc.invalidateQueries({ queryKey: ['proxies'] })}
      />
    </SafeAreaView>
  );
}

/* ============================ Local components ============================ */

function InfoCard({
  label,
  value,
  valueTint = 'text',
  icon,
  onPress,
}: {
  label: string;
  value: string;
  valueTint?: 'text' | 'primary';
  icon: IoniconName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.infoCard, onPress && pressed && styles.pressed]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueTint === 'primary' && styles.infoValuePrimary]}>{value}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
      )}
    </Pressable>
  );
}

function ActionButton({
  label,
  icon,
  illustration,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  illustration: any;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.illuContainer}>
        <Image source={illustration} style={styles.actionIllu} resizeMode="contain" />
      </View>
      <View style={styles.actionBottom}>
        <View style={styles.actionIconBg}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/* ================================ Styles ================================= */

const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.card,
  ...cardShadow,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md },
  pressed: { opacity: 0.85 },

  // Top bar
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  topbarTitle: { flex: 1 },
  topbarHello: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.medium },
  topbarAssoc: { fontSize: font.size.base, fontWeight: font.bold, color: colors.text },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: colors.white, fontSize: 9, fontWeight: font.bold },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.bold, letterSpacing: 0.5 },

  // Hero
  hero: {
    borderRadius: radius.hero,
    padding: spacing.x2,
    gap: 6,
    ...cardShadow,
  },
  heroTitle: { color: colors.white, fontSize: font.size.x2, fontWeight: font.extrabold, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: font.size.sm, lineHeight: font.size.sm * 1.45 },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLabel: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.xs, fontWeight: font.medium },
  sessionValue: { color: colors.white, fontSize: font.size.md, fontWeight: font.bold, marginTop: 1 },

  // Alert
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  alertText: { flex: 1, fontSize: font.size.sm, fontWeight: font.medium, color: colors.danger },

  // Info cards
  infoCard: {
    ...card,
    backgroundColor: colors.greenBg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    height: 72,
  },
  infoLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: font.size.xs,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.text,
    marginTop: 2,
  },
  infoValuePrimary: {
    color: colors.primary,
  },

  // Shared bubble
  bubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Quick actions
  sectionContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: {
    width: '47%',
    flexGrow: 1,
    height: 130,
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: spacing.md,
    justifyContent: 'space-between',
    ...cardShadow,
  },
  illuContainer: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIllu: {
    height: 50,
    width: '100%',
  },
  actionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: font.semibold,
    color: colors.white,
    lineHeight: 14,
  },

  // Recent activity
  activityCard: { ...card, padding: spacing.xl, marginTop: spacing.xs },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  activityDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  activityTitle: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.text },
  activityBody: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  empty: { fontSize: font.size.sm, color: colors.textMuted },
});
