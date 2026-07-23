import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, SectionHeader, IconBubble } from '../../components/ui';
import LoanRequestModal from '../../components/finance/LoanRequestModal';
import { walletsApi } from '../../lib/api/wallets';
import { financeApi } from '../../lib/api/finance';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatNumber, formatXAF, formatXAFSigned } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dateFR(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const LOAN_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: colors.goldAccent },
  counter_offered: { label: 'Contre-offre', bg: colors.goldSoft, fg: colors.goldAccent },
  awaiting_guarantors: { label: 'Attente garants', bg: colors.goldSoft, fg: colors.goldAccent },
  approved: { label: 'Approuvé', bg: colors.greenBg, fg: colors.primary },
  disbursed: { label: 'Décaissé', bg: colors.tintBlueBg, fg: colors.info },
  repaying: { label: 'En remboursement', bg: colors.tintBlueBg, fg: colors.info },
  // Statuts hérités que le backend écrit hors énumération (validate_payment).
  partial: { label: 'En remboursement', bg: colors.tintBlueBg, fg: colors.info },
  completed: { label: 'Remboursé', bg: colors.greenBg, fg: colors.success },
  repaid: { label: 'Remboursé', bg: colors.greenBg, fg: colors.success },
  defaulted: { label: 'En défaut', bg: colors.dangerSoft, fg: colors.danger },
  cancelled: { label: 'Annulé', bg: colors.surfaceAlt, fg: colors.textMuted },
};

export default function FinancesScreen() {
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const [loanOpen, setLoanOpen] = useState(false);

  const walletQ = useQuery({ queryKey: ['wallet', 'me'], queryFn: walletsApi.myWallet });
  const entriesQ = useQuery({ queryKey: ['wallet', 'entries'], queryFn: () => walletsApi.myEntries() });
  const loansQ = useQuery({ queryKey: ['loans', 'mine'], queryFn: () => financeApi.loans() });

  const refreshing = walletQ.isRefetching || entriesQ.isRefetching || loansQ.isRefetching;
  const onRefresh = () => {
    walletQ.refetch();
    entriesQ.refetch();
    loansQ.refetch();
  };

  const balance = walletQ.data?.balance ?? 0;
  const credits = walletQ.data?.total_credits ?? 0;
  const debits = walletQ.data?.total_debits ?? 0;

  const loans = loansQ.data ?? [];
  const entries = (entriesQ.data ?? []).slice(0, 8);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {/* Wallet hero */}
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Text style={styles.heroLabel}>SOLDE DU PORTEFEUILLE</Text>
              <Text style={styles.heroBalance}>
                {formatNumber(balance)} <Text style={styles.heroCurrency}>FCFA</Text>
              </Text>
              <Text style={styles.heroHint}>
                {walletQ.data?.is_frozen ? 'Portefeuille gelé' : 'Solde net virtuel — réglé en fin de cycle'}
              </Text>
            </View>
            <Image source={require('../../assets/illustrations/farmer-wallet.png')} style={styles.illu} resizeMode="contain" />
          </View>

          <View style={styles.subCard}>
            <View style={styles.subItem}>
              <IconBubble icon="arrow-down-circle" tint="lime" size={32} outline />
              <View style={styles.flex}>
                <Text style={styles.subLabel}>Total crédité</Text>
                <Text style={styles.subValue}>{formatNumber(credits)} FCFA</Text>
                <Text style={styles.subHint}>Primes, intérêts, sanctions</Text>
              </View>
            </View>
            <View style={styles.subDivider} />
            <View style={styles.subItem}>
              <IconBubble icon="arrow-up-circle" tint="danger" size={32} outline />
              <View style={styles.flex}>
                <Text style={styles.subLabel}>Total débité</Text>
                <Text style={styles.subValue}>{formatNumber(debits)} FCFA</Text>
                <Text style={styles.subHint}>Défauts, compensations</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Demander un prêt */}
        <Pressable
          onPress={() => setLoanOpen(true)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="cash-outline" size={20} color={colors.white} />
          <Text style={styles.ctaText}>Demander un prêt</Text>
        </Pressable>

        {/* Mes prêts */}
        <Card style={styles.card}>
          <SectionHeader title="Mes prêts" />
          {loansQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : loans.length === 0 ? (
            <Text style={styles.empty}>Aucun prêt en cours.</Text>
          ) : (
            loans.map((l, i) => {
              const st = LOAN_STATUS[String(l.status)] ?? LOAN_STATUS.pending;
              const remaining = Number(l.remaining ?? (Number(l.total_due) - Number(l.total_repaid))) || 0;
              return (
                <View key={l.id} style={[styles.loanRow, i > 0 && styles.loanDivider]}>
                  <View style={styles.loanHead}>
                    <View style={styles.flex}>
                      <Text style={styles.loanAmount}>{formatXAF(l.amount)}</Text>
                      <Text style={styles.loanSub} numberOfLines={1}>
                        {l.purpose?.trim() ? l.purpose : `Intérêt ${formatNumber(l.interest_rate)} %`}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.loanMetaRow}>
                    <Text style={styles.loanMeta}>
                      Restant : <Text style={styles.loanMetaStrong}>{formatXAF(remaining)}</Text>
                    </Text>
                    {l.due_date ? <Text style={styles.loanMeta}>Échéance : {dateFR(l.due_date)}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Transactions */}
        <Card style={styles.card}>
          <SectionHeader title="Dernières opérations" />
          {entriesQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : entries.length === 0 ? (
            <Text style={styles.empty}>Aucune opération pour le moment.</Text>
          ) : (
            entries.map((e, i) => {
              const credit = e.direction === 'credit';
              const signed = (credit ? 1 : -1) * (Number(e.amount) || 0);
              return (
                <View key={e.id} style={[styles.txRow, i > 0 && styles.txDivider]}>
                  <View style={[styles.txDot, !credit && styles.txDotDebit]}>
                    <Ionicons
                      name={credit ? 'arrow-down' : 'arrow-up'}
                      size={15}
                      color={credit ? colors.success : colors.danger}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.txLabel} numberOfLines={1}>
                      {e.source_type_display || e.description || (credit ? 'Crédit' : 'Débit')}
                    </Text>
                    <Text style={styles.txSub} numberOfLines={1}>
                      {dateFR(e.created_at)}
                      {e.session_number != null ? ` · Séance N°${e.session_number}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: credit ? colors.primary : colors.danger }]}>
                    {formatXAFSigned(signed)}
                  </Text>
                </View>
              );
            })
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  pressed: { opacity: 0.85 },

  hero: { borderRadius: radius.hero, padding: 18, ...cardShadow },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: font.size.xs, fontWeight: font.semibold, letterSpacing: 0.5, color: 'rgba(255,255,255,0.85)' },
  heroBalance: { fontSize: font.size.x3, fontWeight: font.bold, color: colors.white, letterSpacing: -0.5, marginTop: 4 },
  heroCurrency: { fontSize: font.size.lg },
  heroHint: { marginTop: 4, fontSize: font.size.xs, color: 'rgba(255,255,255,0.75)' },
  illu: { width: 92, height: 92, marginTop: -2 },
  
  subCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, padding: 14, marginTop: 12, ...cardShadow },
  subItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subDivider: { width: 1, backgroundColor: colors.surfaceAlt, marginHorizontal: 12 },
  subLabel: { fontSize: font.size.xs, color: colors.textMuted },
  subValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  subHint: { fontSize: 10, color: colors.textLight },
  
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green[600],
    borderRadius: radius.pill,
    minHeight: 52,
  },
  ctaText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },

  card: { borderRadius: radius.lg, ...cardShadow },

  // Loans
  loanRow: { paddingVertical: 12 },
  loanDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  loanHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  loanAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  loanSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  loanMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  loanMeta: { fontSize: font.size.sm, color: colors.textMuted },
  loanMetaStrong: { color: colors.primary, fontWeight: font.semibold },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  // Transactions
  empty: { fontSize: font.size.sm, color: colors.textMuted },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  txDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  txDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDotDebit: { borderColor: colors.danger },
  txLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  txSub: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  txAmount: { fontSize: font.size.md, fontWeight: font.bold },
});
