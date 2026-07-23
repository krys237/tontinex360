import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble } from '../../components/ui';
import TabsRow from '../../components/bureau/TabsRow';
import type { BureauStackParamList } from '../../navigation/types';
import type { FundSource } from '../../lib/types/finance';
import { financeApi } from '../../lib/api/finance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatXAFSigned, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauTreasury'>;

const ACCOUNT_TYPE: Record<string, string> = { cash: 'Espèces', bank: 'Banque', mobile_money: 'Mobile Money' };

export default function BureauTreasuryScreen() {
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<'physical' | 'funds'>('physical');
  // Accordéon (un seul fonds déplié) : 'unassigned' pour le bloc non affecté.
  const [expandedFund, setExpandedFund] = useState<string | null>(null);

  const accountsQ = useQuery({ queryKey: ['bureau', 'treasury'], queryFn: () => financeApi.treasury(), retry: false });
  const fundsQ = useQuery({ queryKey: ['bureau', 'tontine-balances'], queryFn: () => financeApi.tontineBalances(), enabled: view === 'funds', retry: false });
  const txQ = useQuery({ queryKey: ['bureau', 'transactions'], queryFn: () => financeApi.transactions(), retry: false });

  const totalPhysical = useMemo(
    () => (accountsQ.data ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accountsQ.data],
  );

  const recentTx = (txQ.data ?? []).slice(0, 12);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={accountsQ.isRefetching || txQ.isRefetching} onRefresh={() => { accountsQ.refetch(); txQ.refetch(); fundsQ.refetch(); }} tintColor={colors.primary} />}
      >
        {/* Solde total */}
        <Card style={styles.totalCard}>
          <IconBubble icon="wallet" tint="primary" size={40} />
          <View>
            <Text style={styles.totalLabel}>Solde total</Text>
            <Text style={styles.totalValue}>{formatXAF(totalPhysical)}</Text>
          </View>
        </Card>

        {/* Liens */}
        <View style={styles.linkRow}>
          <Pressable style={styles.linkCard} onPress={() => navigation.navigate('BureauFinance')}>
            <Ionicons name="card-outline" size={18} color="#A855F7" />
            <Text style={styles.linkTitle}>Cotisations</Text>
            <Text style={styles.linkSub}>Voir le détail →</Text>
          </Pressable>
          <Pressable style={styles.linkCard} onPress={() => navigation.navigate('BureauFinance')}>
            <Ionicons name="document-text-outline" size={18} color={colors.goldAccent} />
            <Text style={styles.linkTitle}>Prêts</Text>
            <Text style={styles.linkSub}>Voir le détail →</Text>
          </Pressable>
          <Pressable style={styles.linkCard} onPress={() => navigation.navigate('BureauWithdrawals')}>
            <Ionicons name="arrow-up-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.linkTitle}>Retraits</Text>
            <Text style={styles.linkSub}>Gérer →</Text>
          </Pressable>
        </View>

        {/* Toggle vue */}
        <View style={styles.tabsWrap}>
          <TabsRow
            tabs={[{ key: 'physical', label: '🏦 Vue par caisse' }, { key: 'funds', label: '🎯 Vue par fonds' }]}
            active={view}
            onChange={(k) => setView(k as typeof view)}
          />
        </View>

        {/* Vue par caisse physique */}
        {view === 'physical' ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Comptes de trésorerie</Text>
              <Text style={styles.sectionHint}>« Où est l'argent ? »</Text>
            </View>
            {accountsQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : (accountsQ.data ?? []).length === 0 ? (
              <Text style={styles.muted}>Aucun compte de trésorerie.</Text>
            ) : (
              (accountsQ.data ?? []).map((a, i) => (
                <View key={a.id} style={[styles.fundRow, i > 0 && styles.divider]}>
                  <IconBubble icon="cash-outline" tint="lime" size={32} />
                  <View style={styles.flex}>
                    <Text style={styles.fundName}>{a.name}</Text>
                    <Text style={styles.fundMeta}>{ACCOUNT_TYPE[a.account_type] ?? a.account_type}</Text>
                  </View>
                  <Text style={styles.fundBalance}>{formatXAF(a.balance)}</Text>
                </View>
              ))
            )}
            <View style={styles.totalLine}>
              <Text style={styles.totalLineLabel}>Total physique</Text>
              <Text style={styles.totalLineValue}>{formatXAF(totalPhysical)}</Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Soldes par fonds</Text>
              <Text style={styles.sectionHint}>« À qui appartient l'argent ? »</Text>
            </View>
            {fundsQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : !fundsQ.data ? (
              <Text style={styles.muted}>Indisponible.</Text>
            ) : (
              <>
                {fundsQ.data.funds.map((f, i) => {
                  const isOpen = expandedFund === f.tontine_type_id;
                  return (
                    <View key={f.tontine_type_id}>
                      <Pressable
                        style={[styles.fundRow, i > 0 && styles.divider]}
                        onPress={() => setExpandedFund(isOpen ? null : f.tontine_type_id)}>
                        <IconBubble icon="layers-outline" tint="primary" size={32} />
                        <View style={styles.flex}>
                          <Text style={styles.fundName}>{f.name}</Text>
                          <Text style={styles.fundMeta}>+{formatXAF(f.credits)} − {formatXAF(f.debits)}</Text>
                        </View>
                        <Text style={styles.fundBalance}>{formatXAF(f.balance)}</Text>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textLight} />
                      </Pressable>
                      {isOpen ? (
                        <View style={styles.fundDetail}>
                          <SourceBreakdown sources={f.by_source} />
                          <FundWeightsBlock fundId={f.tontine_type_id} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <Pressable
                  style={[styles.fundRow, styles.divider, styles.unassigned]}
                  onPress={() => setExpandedFund(expandedFund === 'unassigned' ? null : 'unassigned')}>
                  <IconBubble icon="help-circle-outline" tint="accent" size={32} />
                  <View style={styles.flex}>
                    <Text style={styles.fundName}>{fundsQ.data.unassigned.name ?? 'Non affecté'}</Text>
                    <Text style={styles.fundMeta}>Frais admin / sanctions / transactions sans tag</Text>
                  </View>
                  <Text style={[styles.fundBalance, { color: Number(fundsQ.data.unassigned.balance) < 0 ? colors.danger : colors.text }]}>
                    {formatXAFSigned(Number(fundsQ.data.unassigned.balance))}
                  </Text>
                  <Ionicons name={expandedFund === 'unassigned' ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textLight} />
                </Pressable>
                {expandedFund === 'unassigned' ? (
                  <View style={styles.fundDetail}>
                    <SourceBreakdown sources={fundsQ.data.unassigned.by_source} />
                  </View>
                ) : null}
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>Total virtuel</Text>
                  <Text style={styles.totalLineValue}>{formatXAF(fundsQ.data.total)}</Text>
                </View>
                <Text style={styles.note}>Le total virtuel est égal au total physique : même argent, vu sous deux angles.</Text>
              </>
            )}
          </Card>
        )}

        {/* Synthèse globale par source */}
        {view === 'funds' && (fundsQ.data?.by_source_global?.length ?? 0) > 0 ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Par source (toute la trésorerie)</Text>
              <Text style={styles.sectionHint}>« D'où vient l'argent ? »</Text>
            </View>
            {(fundsQ.data!.by_source_global ?? []).map((src, i) => (
              <View key={src.type} style={[styles.srcRow, i > 0 && styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.fundName}>{src.label}</Text>
                  <Text style={styles.fundMeta}>+{formatXAF(src.credit)} − {formatXAF(src.debit)}</Text>
                </View>
                <Text style={[styles.fundBalance, { color: Number(src.net) < 0 ? colors.danger : colors.primary }]}>
                  {formatXAFSigned(Number(src.net))}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Dernières transactions */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dernières transactions</Text>
          {txQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : recentTx.length === 0 ? (
            <Text style={styles.muted}>Aucune transaction.</Text>
          ) : (
            recentTx.map((t, i) => (
              <View key={t.id} style={[styles.txRow, i > 0 && styles.divider]}>
                <IconBubble icon={t.is_debit ? 'arrow-up' : 'arrow-down'} tint={t.is_debit ? 'danger' : 'lime'} size={30} />
                <View style={styles.flex}>
                  <Text style={styles.txDesc} numberOfLines={1}>{t.description?.trim() ? t.description : t.transaction_type}</Text>
                  <Text style={styles.txDate}>{timeAgo(t.created_at)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: t.is_debit ? colors.danger : colors.primary }]}>
                  {formatXAFSigned(t.is_debit ? -Number(t.amount) : Number(t.amount))}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Ventilation par source d'un fonds (cotisations, sanctions, prêts, dépenses…). */
function SourceBreakdown({ sources }: { sources?: FundSource[] }) {
  if (!sources || sources.length === 0) {
    return <Text style={styles.detailEmpty}>Aucun mouvement ventilé sur ce fonds.</Text>;
  }
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailTitle}>Par source</Text>
      {sources.map((s) => (
        <View key={s.type} style={styles.detailRow}>
          <Text style={styles.detailLabel} numberOfLines={1}>{s.label}</Text>
          <Text style={[styles.detailValue, { color: Number(s.net) < 0 ? colors.danger : colors.primary }]}>
            {formatXAFSigned(Number(s.net))}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Poids d'apport des membres — base du partage des intérêts de prêt. */
function FundWeightsBlock({ fundId }: { fundId: string }) {
  const q = useQuery({
    queryKey: ['bureau', 'fund', fundId, 'weights'],
    queryFn: () => financeApi.fundWeights(fundId),
  });
  if (q.isLoading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />;
  const members = q.data?.members ?? [];
  if (members.length === 0) return null;
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailTitle}>Poids des membres</Text>
      <Text style={styles.detailHint}>Base du partage des intérêts de prêt de ce fonds.</Text>
      {members.map((m) => (
        <View key={m.membership} style={styles.detailRow}>
          <Text style={styles.detailLabel} numberOfLines={1}>{m.member_name}</Text>
          <Text style={styles.detailValue}>
            {formatXAF(m.contributed)} · {Number(m.weight_pct).toFixed(1).replace('.', ',')} %
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  totalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg },
  totalLabel: { fontSize: font.size.sm, color: colors.textMuted },
  totalValue: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text },

  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: 2, ...cardShadow },
  linkTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginTop: 4 },
  linkSub: { fontSize: font.size.xs, color: colors.primary },

  tabsWrap: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },

  sectionCard: { borderRadius: radius.lg, gap: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sectionHint: { fontSize: font.size.xs, color: colors.textLight, fontStyle: 'italic' },
  muted: { fontSize: font.size.sm, color: colors.textMuted, paddingVertical: spacing.sm },

  fundRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  unassigned: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  fundName: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  fundMeta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  fundBalance: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },

  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 2, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm, marginTop: 4 },
  totalLineLabel: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  totalLineValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  note: { fontSize: font.size.xs, color: colors.info, fontStyle: 'italic', marginTop: spacing.xs },

  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  fundDetail: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailBlock: { gap: 4 },
  detailTitle: { fontSize: 10, fontWeight: font.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailHint: { fontSize: font.size.xs, color: colors.textLight, fontStyle: 'italic' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 3 },
  detailLabel: { flex: 1, fontSize: font.size.sm, color: colors.text },
  detailValue: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  detailEmpty: { fontSize: font.size.xs, color: colors.textMuted },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  txDesc: { fontSize: font.size.sm, color: colors.text },
  txDate: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  txAmount: { fontSize: font.size.sm, fontWeight: font.bold },
});
