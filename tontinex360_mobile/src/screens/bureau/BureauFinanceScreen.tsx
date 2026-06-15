import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { financeApi } from '../../lib/api/finance';
import { contributionStatus, loanStatus } from '../../lib/bureau/finance-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatXAFSigned, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauFinance'>;
type TabKey = 'contributions' | 'loans' | 'repayments' | 'transactions';

const PENDING_CONTRIB = ['pending', 'submitted', 'partial'];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauFinanceScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('contributions');

  const contribQ = useQuery({
    queryKey: ['bureau', 'contributions'],
    queryFn: () => financeApi.contributions(),
    enabled: tab === 'contributions',
  });
  const loansQ = useQuery({
    queryKey: ['bureau', 'loans'],
    queryFn: () => financeApi.loans(),
    enabled: tab === 'loans',
  });
  const repaymentsQ = useQuery({
    queryKey: ['bureau', 'loan-repayments'],
    queryFn: () => financeApi.loanRepayments(),
    enabled: tab === 'repayments',
  });
  const txQ = useQuery({
    queryKey: ['bureau', 'transactions'],
    queryFn: () => financeApi.transactions(),
    enabled: tab === 'transactions',
  });

  const validateMut = useMutation({
    mutationFn: (id: string) => financeApi.validateContribution(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'contributions'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => financeApi.rejectContribution(id, 'Justificatif non conforme'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'contributions'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const tabs = [
    { key: 'contributions', label: 'Cotisations' },
    { key: 'loans', label: 'Prêts' },
    { key: 'repayments', label: 'Remboursements' },
    { key: 'transactions', label: 'Transactions' },
  ];

  const activeQ =
    tab === 'contributions' ? contribQ : tab === 'loans' ? loansQ : tab === 'repayments' ? repaymentsQ : txQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activeQ.isRefetching}
            onRefresh={() => activeQ.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {activeQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : null}

        {/* ---- Cotisations ---- */}
        {tab === 'contributions' && !contribQ.isLoading
          ? (contribQ.data ?? []).map((c) => {
              const st = contributionStatus(c.status);
              const canAct = PENDING_CONTRIB.includes(c.status);
              return (
                <Pressable
                  key={c.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('BureauContributionDetail', { id: c.id })}
                >
                  <IconBubble icon="cash" tint={c.status === 'paid' ? 'lime' : 'accent'} size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{formatXAF(c.paid_amount || c.expected_amount)}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {c.member_name ?? 'Membre'}
                    </Text>
                  </View>
                  {canAct ? (
                    <>
                      <ActionBtn
                        icon="checkmark"
                        tone="success"
                        loading={validateMut.isPending && validateMut.variables === c.id}
                        onPress={() => validateMut.mutate(c.id)}
                      />
                      <ActionBtn
                        icon="close"
                        tone="danger"
                        loading={rejectMut.isPending && rejectMut.variables === c.id}
                        onPress={() => rejectMut.mutate(c.id)}
                      />
                    </>
                  ) : (
                    <StatusChip label={st.label} tone={st.tone} />
                  )}
                </Pressable>
              );
            })
          : null}
        {tab === 'contributions' && !contribQ.isLoading && (contribQ.data ?? []).length === 0 ? (
          <Empty icon="cash-outline" text="Aucune cotisation." />
        ) : null}

        {/* ---- Prêts ---- */}
        {tab === 'loans' && !loansQ.isLoading
          ? (loansQ.data ?? []).map((l) => {
              const st = loanStatus(l.status);
              return (
                <Pressable
                  key={l.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('BureauLoanDetail', { id: l.id })}
                >
                  <IconBubble icon="trending-up" tint="primary" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{formatXAF(l.amount)}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {l.member_name ?? 'Membre'}
                    </Text>
                  </View>
                  <StatusChip label={st.label} tone={st.tone} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              );
            })
          : null}
        {tab === 'loans' && !loansQ.isLoading && (loansQ.data ?? []).length === 0 ? (
          <Empty icon="trending-up" text="Aucun prêt." />
        ) : null}

        {/* ---- Remboursements ---- */}
        {tab === 'repayments' && !repaymentsQ.isLoading
          ? (repaymentsQ.data ?? []).map((r) => (
              <View key={r.id} style={styles.row}>
                <IconBubble icon="repeat" tint="lime" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{formatXAF(r.amount)}</Text>
                  <Text style={styles.rowSub}>{timeAgo(r.paid_at)}</Text>
                </View>
                {r.has_receipt ? <StatusChip label="Signé" tone="success" /> : null}
              </View>
            ))
          : null}
        {tab === 'repayments' && !repaymentsQ.isLoading && (repaymentsQ.data ?? []).length === 0 ? (
          <Empty icon="repeat" text="Aucun remboursement." />
        ) : null}

        {/* ---- Transactions ---- */}
        {tab === 'transactions' && !txQ.isLoading
          ? (txQ.data ?? []).map((t) => (
              <View key={t.id} style={styles.row}>
                <IconBubble icon={t.is_debit ? 'arrow-up' : 'arrow-down'} tint={t.is_debit ? 'danger' : 'lime'} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{formatXAFSigned(t.is_debit ? -Number(t.amount) : Number(t.amount))}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {t.description?.trim() ? t.description : t.transaction_type}
                  </Text>
                </View>
                <Text style={styles.txDate}>{timeAgo(t.created_at)}</Text>
              </View>
            ))
          : null}
        {tab === 'transactions' && !txQ.isLoading && (txQ.data ?? []).length === 0 ? (
          <Empty icon="swap-horizontal" text="Aucune transaction." />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <IconBubble icon={icon} tint="lime" size={56} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  tabsWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
  },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  txDate: { fontSize: font.size.xs, color: colors.textLight },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
