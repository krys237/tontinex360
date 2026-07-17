import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import LoanRequestModal from '../../components/finance/LoanRequestModal';
import { tontinesApi } from '../../lib/api/tontines';
import { cyclesApi } from '../../lib/api/cycles';
import { financeApi } from '../../lib/api/finance';
import { proxiesApi } from '../../lib/api/proxies';
import { sanctionsApi } from '../../lib/api/sanctions';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow, liftedShadow } from '../../theme/shadow';
import type { AppTabsParamList, AppStackParamList } from '../../navigation/types';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
function frDate(iso?: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '—';
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, 'Tontines'>,
  NativeStackNavigationProp<AppStackParamList>
>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Dest = keyof AppStackParamList;

export default function TontineHubScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const [loanOpen, setLoanOpen] = useState(false);

  const subsQ = useQuery({ queryKey: ['tontines', 'subs'], queryFn: () => tontinesApi.subscriptions() });
  const bidsQ = useQuery({ queryKey: ['cycle', 'bids'], queryFn: () => cyclesApi.bids() });
  const contribQ = useQuery({
    queryKey: ['contributions', 'mine', myId ?? null],
    queryFn: () => financeApi.contributions(myId ? { membership: myId } : undefined),
  });
  const proxiesQ = useQuery({ queryKey: ['proxies'], queryFn: () => proxiesApi.list() });
  const loansQ = useQuery({
    queryKey: ['loans', 'mine', myId ?? null],
    queryFn: () => financeApi.loans(myId ? { membership: myId } : undefined),
  });
  const sanctionsQ = useQuery({
    queryKey: ['sanctions', 'mine', myId ?? null],
    queryFn: () => sanctionsApi.list(myId ? { membership: myId } : undefined),
  });

  const refreshing =
    subsQ.isRefetching || bidsQ.isRefetching || contribQ.isRefetching || proxiesQ.isRefetching ||
    loansQ.isRefetching || sanctionsQ.isRefetching;
  const onRefresh = () => {
    subsQ.refetch();
    bidsQ.refetch();
    contribQ.refetch();
    proxiesQ.refetch();
    loansQ.refetch();
    sanctionsQ.refetch();
  };

  // Données prêt pour la hero-card
  const loans = loansQ.data ?? [];
  const totalBorrowed = loans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const repaidCount = loans.filter((l) => l.status === 'repaid').length;
  const todayISO = new Date().toISOString().slice(0, 10);
  const nextDue = loans
    .filter((l) => l.status !== 'repaid' && !!l.due_date && (l.due_date as string) >= todayISO)
    .map((l) => l.due_date as string)
    .sort((a, b) => a.localeCompare(b))[0];

  const subsCount = (subsQ.data ?? []).filter((s) => !myId || s.membership === myId).length;
  const bidsCount = (bidsQ.data ?? []).filter((b) => b.membership === myId).length;
  const versed = (contribQ.data ?? []).reduce((sum, c) => sum + (Number(c.paid_amount) || 0), 0);
  const proxiesCount = (proxiesQ.data ?? []).filter(
    (p) => p.grantor === myId && p.status !== 'rejected' && p.status !== 'cancelled',
  ).length;
  const loansCount = loans.length;
  const sanctions = sanctionsQ.data ?? [];
  const pendingSanctions = sanctions.filter((s) => s.status === 'pending').length;

  const folders: {
    title: string;
    icon: IoniconName;
    value: string;
    sub: string;
    dest: Dest;
    variant?: 'inline';
    palette: { base: string; s1: string; s2: string; fg: string };
  }[] = [
      {
        title: 'Mes tontines',
        icon: 'albums',
        value: String(subsCount),
        sub: subsCount > 1 ? 'souscriptions' : 'souscription',
        dest: 'MesTontines',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
      {
        title: 'Mes enchères',
        icon: 'hammer',
        value: String(bidsCount),
        sub: bidsCount > 1 ? 'enchères' : 'enchère',
        dest: 'MesEncheres',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
      {
        title: 'Mes versements',
        icon: 'cash',
        value: `${formatNumber(versed)}`,
        sub: 'FCFA versés',
        dest: 'MesVersements',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
      {
        title: 'Mes procurations',
        icon: 'document-text',
        value: String(proxiesCount),
        sub: proxiesCount > 1 ? 'en cours' : 'procuration',
        dest: 'Procurations',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
      {
        title: 'Mes prêts',
        icon: 'cash-outline',
        value: String(loansCount),
        sub: loansCount > 1 ? 'prêts' : 'prêt',
        dest: 'MesPrets',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
      {
        title: 'Mes sanctions',
        icon: 'alert-circle-outline',
        value: String(sanctions.length),
        sub: pendingSanctions > 0 ? `${pendingSanctions} à régler` : (sanctions.length > 1 ? 'sanctions' : 'sanction'),
        dest: 'MesSanctions',
        variant: 'inline',
        palette: { base: colors.green[600], s1: colors.primary, s2: '#6BA45C', fg: colors.white },
      },
    ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <Text style={styles.title}>Tontines</Text>

        <LoanHeroCard
          totalBorrowed={totalBorrowed}
          repaidCount={repaidCount}
          nextDueLabel={frDate(nextDue)}
          onRequest={() => setLoanOpen(true)}
        />

        <Text style={styles.subtitle}>
          Vos souscriptions, enchères, versements et procurations en un coup d'œil.
        </Text>

        <View style={styles.grid}>
          {folders.map((f) => (
            <FolderCard key={f.title} {...f} onPress={() => navigation.navigate(f.dest as never)} />
          ))}
        </View>
      </ScrollView>

      <LoanRequestModal
        visible={loanOpen}
        onClose={() => setLoanOpen(false)}
        membershipId={myId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['loans'] });
          qc.invalidateQueries({ queryKey: ['wallet', 'me'] });
        }}
      />
    </SafeAreaView>
  );
}

function LoanHeroCard({
  totalBorrowed,
  repaidCount,
  nextDueLabel,
  onRequest,
}: {
  totalBorrowed: number;
  repaidCount: number;
  nextDueLabel: string;
  onRequest: () => void;
}) {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.flex}>
          <Text style={styles.heroTitle}>Réalisez vos projets avec sérénité</Text>
          <Text style={styles.heroSub}>Demandez un prêt et avancez en toute confiance.</Text>
        </View>
        <Image
          source={require('../../assets/illustrations/icone-tontine.png')}
          style={styles.heroIllu}
          resizeMode="contain"
        />
      </View>

      <View style={styles.quick}>
        <Text style={styles.quickTitle}>Aperçu rapide</Text>
        <View style={styles.quickRow}>
          <View style={styles.quickItem}>
            <View style={styles.quickIcon}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Total emprunté</Text>
            <Text style={styles.quickValue} numberOfLines={1}>{formatNumber(totalBorrowed)} fcfa</Text>
          </View>
          <View style={styles.quickDivider} />
          <View style={styles.quickItem}>
            <View style={styles.quickIcon}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Prêts remboursés</Text>
            <Text style={styles.quickValue}>{repaidCount}</Text>
          </View>
          <View style={styles.quickDivider} />
          <View style={styles.quickItem}>
            <View style={styles.quickIcon}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Prochaine échéance</Text>
            <Text style={styles.quickValue} numberOfLines={1}>{nextDueLabel}</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={onRequest} style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}>
        <Ionicons name="cash-outline" size={18} color={colors.white} />
        <Text style={styles.heroBtnText}>Faire une demande</Text>
      </Pressable>
    </LinearGradient>
  );
}

function FolderCard({
  title,
  icon,
  value,
  sub,
  palette,
  variant,
  onPress,
}: {
  title: string;
  icon: IoniconName;
  value: string;
  sub: string;
  palette: { base: string; s1: string; s2: string; fg: string };
  variant?: 'inline';
  onPress: () => void;
}) {
  const { base, s1, fg } = palette;
  const muted = fg === colors.white ? 'rgba(255,255,255,0.85)' : 'rgba(35,43,29,0.7)';
  const Icon = (
    <View
      style={[
        styles.iconSquare,
        variant === 'inline' && styles.iconSquareInline,
        { backgroundColor: colors.white },
      ]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.folder, pressed && styles.pressed]}>
      {/* Dossier Arrière (Back Tab) */}
      <View style={[styles.folderBack, { backgroundColor: s1 }]} />
      {/* Feuille de papier intérieure (Paper Sheet) */}
      <View style={styles.folderPaper} />
      {/* Dossier Avant (Front Card) */}
      <View style={[styles.folderFront, { backgroundColor: base }]}>
        {variant === 'inline' ? (
          <>
            <View style={styles.inlineTop}>
              {Icon}
              <View style={styles.flex}>
                <Text style={[styles.folderValue, { color: fg }]} numberOfLines={1}>
                  {value}
                </Text>
                <Text style={[styles.folderSub, { color: muted }]} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
            </View>
            <Text style={[styles.folderTitle, { color: muted }]} numberOfLines={1}>
              {title}
            </Text>
          </>
        ) : (
          <>
            {Icon}
            <Text style={[styles.folderTitle, { color: muted }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.folderValue, { color: fg }]} numberOfLines={1}>
              {value}
            </Text>
            <Text style={[styles.folderSub, { color: muted }]} numberOfLines={1}>
              {sub}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const GAP = spacing.md;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 96 },
  pressed: { opacity: 0.92 },

  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, paddingTop: spacing.sm },
  subtitle: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: font.size.sm * 1.4 },

  // Loan hero card
  hero: { borderRadius: radius.card, padding: spacing.lg, ...cardShadow },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroTitle: { fontSize: font.size.lg, fontWeight: font.extrabold, color: colors.white, letterSpacing: -0.3 },
  heroSub: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: font.size.sm * 1.4 },
  heroIllu: { width: 76, height: 76, marginTop: -4 },
  quick: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, ...cardShadow },
  quickTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginBottom: spacing.md },
  quickRow: { flexDirection: 'row', alignItems: 'flex-start' },
  quickItem: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  quickDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, marginHorizontal: 4 },
  quickIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  quickLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  quickValue: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary, textAlign: 'center' },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.green[600], borderRadius: radius.pill, minHeight: 52, marginTop: spacing.md,
  },
  heroBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  folder: {
    width: '47%',
    flexGrow: 1,
    height: 130,
    position: 'relative',
  },
  folderBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  folderPaper: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    height: 50,
    backgroundColor: colors.white,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  folderFront: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    padding: spacing.md,
    justifyContent: 'flex-start',
    ...liftedShadow,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconSquareInline: { marginBottom: 0 },
  inlineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  folderTitle: { fontSize: font.size.sm, fontWeight: font.medium },
  folderValue: { fontSize: font.size.x2, fontWeight: font.extrabold, letterSpacing: -0.4, marginTop: 2 },
  folderSub: { fontSize: font.size.xs, marginTop: 1 },
});
