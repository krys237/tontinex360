import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip from '../../components/bureau/StatusChip';
import SignatureModal from '../../components/bureau/SignatureModal';
import ContributionCorrectionModal from '../../components/bureau/ContributionCorrectionModal';
import ContributionTopUpModal from '../../components/bureau/ContributionTopUpModal';
import LoanRequestModal from '../../components/bureau/LoanRequestModal';
import ApprovalRequestModal, { type ApprovalField } from '../../components/bureau/ApprovalRequestModal';
import RequirePermission from '../../components/bureau/RequirePermission';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import type { Contribution, Loan } from '../../lib/types/finance';
import type { ApprovalActionType } from '../../lib/types/approval';
import { financeApi } from '../../lib/api/finance';
import { membersApi } from '../../lib/api/members';
import { sessionsApi } from '../../lib/api/sessions';
import { contributionStatus, loanStatus } from '../../lib/bureau/finance-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatXAFSigned, formatDateFr, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauFinance'>;
type TabKey = 'contributions' | 'loans' | 'repayments' | 'transactions';

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous statuts' },
  { key: 'pending', label: 'En attente' },
  { key: 'submitted', label: 'À valider' },
  { key: 'paid', label: 'Payée' },
  { key: 'partial', label: 'Partielle' },
  { key: 'defaulted', label: 'Impayée' },
];

const LOAN_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous statuts' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvé' },
  { key: 'disbursed', label: 'Décaissé' },
  { key: 'repaying', label: 'En remb.' },
  { key: 'repaid', label: 'Remboursé' },
  { key: 'defaulted', label: 'Défaut' },
];

type LoanAction = { loan: Loan; actionType: ApprovalActionType; title: string; fields: ApprovalField[]; contextSummary?: string };

export default function BureauFinanceScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<TabKey>('contributions');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [correcting, setCorrecting] = useState<Contribution | null>(null);
  const [toppingUp, setToppingUp] = useState<Contribution | null>(null);
  const [signing, setSigning] = useState<Contribution | null>(null);
  const [refSigUrl, setRefSigUrl] = useState<string | null>(null);
  const [loanStatusFilter, setLoanStatusFilter] = useState('');
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanAction, setLoanAction] = useState<LoanAction | null>(null);

  const sessionsQ = useQuery({
    queryKey: ['bureau', 'sessions', 'finance'],
    queryFn: () => sessionsApi.list(),
    enabled: tab === 'contributions',
    retry: false,
  });

  const contribQ = useQuery({
    queryKey: ['bureau', 'contributions', sessionId, status],
    queryFn: () =>
      financeApi.contributions({
        ...(sessionId ? { session: sessionId } : {}),
        ...(status ? { status } : {}),
      }),
    enabled: tab === 'contributions',
  });
  const loansQ = useQuery({
    queryKey: ['bureau', 'loans', loanStatusFilter],
    queryFn: () => financeApi.loans(loanStatusFilter ? { status: loanStatusFilter } : undefined),
    enabled: tab === 'loans',
  });
  const repaymentsQ = useQuery({ queryKey: ['bureau', 'loan-repayments'], queryFn: () => financeApi.loanRepayments(), enabled: tab === 'repayments' });
  const txQ = useQuery({ queryKey: ['bureau', 'transactions'], queryFn: () => financeApi.transactions(), enabled: tab === 'transactions' });

  const totals = useMemo(() => {
    return (contribQ.data ?? []).reduce(
      (acc, c) => {
        acc.expected += Number(c.expected_amount ?? 0);
        acc.paid += Number(c.paid_amount ?? 0);
        return acc;
      },
      { expected: 0, paid: 0 },
    );
  }, [contribQ.data]);

  const loanTotals = useMemo(() => {
    return (loansQ.data ?? []).reduce(
      (acc, l) => {
        acc.lent += Number(l.amount ?? 0);
        acc.repaid += Number(l.total_repaid ?? 0);
        return acc;
      },
      { lent: 0, repaid: 0 },
    );
  }, [loansQ.data]);

  const openSigning = async (c: Contribution) => {
    setSigning(c);
    setRefSigUrl(null);
    try {
      const m = await membersApi.get(c.membership);
      setRefSigUrl(m.signature_reference ?? null);
    } catch {
      setRefSigUrl(null);
    }
  };

  const tabs = [
    { key: 'contributions', label: 'Cotisations' },
    { key: 'loans', label: 'Prêts' },
    { key: 'repayments', label: 'Remboursements' },
    { key: 'transactions', label: 'Transactions' },
  ];

  const activeQ = tab === 'contributions' ? contribQ : tab === 'loans' ? loansQ : tab === 'repayments' ? repaymentsQ : txQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={activeQ.isRefetching} onRefresh={() => activeQ.refetch()} tintColor={colors.primary} />}
      >
        {/* ===================== COTISATIONS ===================== */}
        {tab === 'contributions' ? (
          <>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <KpiStat label="Total attendu" value={formatXAF(totals.expected)} tone="neutral" />
              <KpiStat label="Total payé" value={formatXAF(totals.paid)} tone="success" />
            </View>
            <KpiStat label="Reste à percevoir" value={formatXAF(totals.expected - totals.paid)} tone="danger" full />

            {/* Filtres */}
            <FilterChips
              options={[{ key: '', label: 'Toutes les séances' }, ...(sessionsQ.data ?? []).map((s) => ({ key: s.id, label: `Séance n°${s.session_number}` }))]}
              value={sessionId}
              onChange={setSessionId}
            />
            <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />

            {contribQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
            ) : (contribQ.data ?? []).length === 0 ? (
              <Empty icon="cash-outline" text="Aucune cotisation." />
            ) : (
              (contribQ.data ?? []).map((c) => {
                const st = contributionStatus(c.status);
                const canSign = (c.status === 'paid' || c.status === 'partial') && !c.has_receipt;
                const canCorrect = !c.has_receipt && !c.has_pending_correction;
                const canTopUp = Number(c.paid_amount) < Number(c.expected_amount) && !['rejected', 'submitted'].includes(c.status);
                const dateStr = c.paid_at ? formatDateFr(c.paid_at, false) : c.created_at ? formatDateFr(c.created_at, false) : '—';
                return (
                  <Pressable key={c.id} style={styles.cCard} onPress={() => navigation.navigate('BureauContributionDetail', { id: c.id })}>
                    <View style={styles.cTop}>
                      <IconBubble icon="cash" tint={c.status === 'paid' ? 'lime' : 'accent'} size={40} />
                      <View style={styles.flex}>
                        <Text style={styles.cMember} numberOfLines={1}>{c.member_name ?? 'Membre'}</Text>
                        <Text style={styles.cTontine} numberOfLines={1}>{c.tontine_type_name ?? c.tontine_type}</Text>
                      </View>
                      <View style={styles.cStatusCol}>
                        <StatusChip label={st.label} tone={st.tone} />
                        {c.has_pending_correction ? (
                          <View style={styles.corrPending}>
                            <Ionicons name="time-outline" size={10} color={colors.goldAccent} />
                            <Text style={styles.corrPendingText}>Correction</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.cAmounts}>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Attendu</Text>
                        <Text style={styles.cAmountVal}>{formatXAF(c.expected_amount)}</Text>
                      </View>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Payé</Text>
                        <Text style={[styles.cAmountVal, styles.cPaid]}>{formatXAF(c.paid_amount)}</Text>
                      </View>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Date</Text>
                        <Text style={styles.cDate}>{dateStr}</Text>
                      </View>
                    </View>

                    {/* Actions bordereau */}
                    {(canTopUp || canCorrect || canSign || (c.has_receipt && c.receipt_pdf)) ? (
                      <View style={styles.cActions}>
                        {canTopUp ? (
                          <MiniBtn icon="add-circle-outline" label="Compléter" tone="primary" onPress={() => setToppingUp(c)} />
                        ) : null}
                        {canCorrect ? (
                          <MiniBtn icon="warning-outline" label="Corriger" tone="warning" onPress={() => setCorrecting(c)} />
                        ) : null}
                        {c.has_receipt && c.receipt_pdf ? (
                          <MiniBtn icon="download-outline" label="PDF" tone="success" onPress={() => Linking.openURL(c.receipt_pdf as string)} />
                        ) : canSign ? (
                          <MiniBtn icon="pencil" label="Signer" tone="primary" onPress={() => openSigning(c)} />
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}

        {/* ===================== PRÊTS ===================== */}
        {tab === 'loans' ? (
          <>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <KpiStat label="Prêts actifs" value={String((loansQ.data ?? []).length)} tone="neutral" />
              <KpiStat label="Total prêté" value={formatXAF(loanTotals.lent)} tone="neutral" />
            </View>
            <KpiStat label="Total remboursé" value={formatXAF(loanTotals.repaid)} tone="success" full />

            {/* Actions */}
            <View style={styles.loanBtns}>
              <Pressable style={styles.loanPrimaryBtn} onPress={() => setShowLoanForm(true)}>
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.loanPrimaryText}>Demander un prêt</Text>
              </Pressable>
              <RequirePermission bureau>
                <Pressable style={styles.loanOutlineBtn} onPress={() => navigation.navigate('BureauLoanAllocate')}>
                  <Ionicons name="file-tray-full-outline" size={15} color={colors.primary} />
                  <Text style={styles.loanOutlineText}>Allouer en lot</Text>
                </Pressable>
              </RequirePermission>
              <Pressable style={[styles.loanOutlineBtn, styles.loanGoldBtn]} onPress={() => navigation.navigate('BureauMyGuarantees')}>
                <Ionicons name="shield-outline" size={15} color={colors.goldAccent} />
                <Text style={[styles.loanOutlineText, { color: colors.goldAccent }]}>Mes garanties</Text>
              </Pressable>
              <RequirePermission bureau>
                <Pressable style={styles.loanOutlineBtn} onPress={() => navigation.navigate('BureauTreasury')}>
                  <Ionicons name="business-outline" size={15} color={colors.primary} />
                  <Text style={styles.loanOutlineText}>Trésorerie</Text>
                </Pressable>
              </RequirePermission>
            </View>

            {/* Filtre statut */}
            <FilterChips options={LOAN_STATUS_FILTERS} value={loanStatusFilter} onChange={setLoanStatusFilter} />

            {loansQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
            ) : (loansQ.data ?? []).length === 0 ? (
              <Empty icon="trending-up" text="Aucun prêt." />
            ) : (
              (loansQ.data ?? []).map((l) => {
                const st = loanStatus(l.status);
                const canApprove = l.status === 'pending';
                const canModify = ['pending', 'approved', 'disbursed'].includes(String(l.status));
                const canWriteOff = ['disbursed', 'repaying'].includes(String(l.status));
                return (
                  <Pressable key={l.id} style={styles.cCard} onPress={() => navigation.navigate('BureauLoanDetail', { id: l.id })}>
                    <View style={styles.cTop}>
                      <IconBubble icon="trending-up" tint="primary" size={40} />
                      <View style={styles.flex}>
                        <Text style={styles.cMember} numberOfLines={1}>{l.member_name ?? 'Membre'}</Text>
                        <Text style={styles.cTontine}>Taux {Number(l.interest_rate)}%{l.due_date ? ` · éch. ${formatDateFr(l.due_date, false)}` : ''}</Text>
                      </View>
                      <StatusChip label={st.label} tone={st.tone} />
                    </View>

                    <View style={styles.cAmounts}>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Montant</Text>
                        <Text style={styles.cAmountVal}>{formatXAF(l.amount)}</Text>
                      </View>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Total dû</Text>
                        <Text style={styles.cAmountVal}>{formatXAF(l.total_due)}</Text>
                      </View>
                      <View style={styles.cAmountCell}>
                        <Text style={styles.cAmountLabel}>Remboursé</Text>
                        <Text style={[styles.cAmountVal, styles.cPaid]}>{formatXAF(l.total_repaid)}</Text>
                      </View>
                    </View>

                    {(canApprove || canModify || canWriteOff) ? (
                      <RequirePermission bureau>
                        <View style={styles.cActions}>
                          {canApprove ? (
                            <MiniBtn icon="checkmark-circle" label="Approuver" tone="success" onPress={() => setLoanAction({
                              loan: l, actionType: 'loan.approve', title: 'Approuver et décaisser le prêt',
                              contextSummary: `${formatXAF(l.amount)} · taux ${Number(l.interest_rate)}% · total dû ${formatXAF(l.total_due)}`, fields: [],
                            })} />
                          ) : null}
                          {canModify ? (
                            <MiniBtn icon="pencil" label="Modifier" tone="primary" onPress={() => setLoanAction({
                              loan: l, actionType: 'loan.modify', title: 'Modifier le prêt',
                              contextSummary: `Montant ${formatXAF(l.amount)} · taux ${Number(l.interest_rate)}% · éch. ${l.due_date ?? '—'}`,
                              fields: [
                                { name: 'new_amount', label: 'Nouveau montant (XAF)', type: 'number', placeholder: 'Optionnel' },
                                { name: 'new_interest_rate', label: 'Nouveau taux (%)', type: 'number', placeholder: 'Optionnel' },
                                { name: 'new_due_date', label: 'Nouvelle échéance (AAAA-MM-JJ)', type: 'text', placeholder: 'Optionnel' },
                              ],
                            })} />
                          ) : null}
                          {canWriteOff ? (
                            <MiniBtn icon="close-circle" label="Radier" tone="danger" onPress={() => setLoanAction({
                              loan: l, actionType: 'loan.write_off', title: 'Radier ce prêt (mise en défaut)',
                              contextSummary: `Perte estimée : ${formatXAF(Number(l.total_due) - Number(l.total_repaid))}`, fields: [],
                            })} />
                          ) : null}
                        </View>
                      </RequirePermission>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}

        {/* ===================== REMBOURSEMENTS ===================== */}
        {tab === 'repayments' ? (
          repaymentsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
          ) : (repaymentsQ.data ?? []).length === 0 ? (
            <Empty icon="repeat" text="Aucun remboursement." />
          ) : (
            (repaymentsQ.data ?? []).map((r) => (
              <View key={r.id} style={styles.row}>
                <IconBubble icon="repeat" tint="lime" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{formatXAF(r.amount)}</Text>
                  <Text style={styles.rowSub}>{timeAgo(r.paid_at)}{r.payment_method ? ` · ${r.payment_method}` : ''}</Text>
                </View>
                {r.has_receipt ? <StatusChip label="Signé" tone="success" /> : <StatusChip label="Non signé" tone="muted" />}
              </View>
            ))
          )
        ) : null}

        {/* ===================== TRANSACTIONS ===================== */}
        {tab === 'transactions' ? (
          txQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
          ) : (txQ.data ?? []).length === 0 ? (
            <Empty icon="swap-horizontal" text="Aucune transaction." />
          ) : (
            (txQ.data ?? []).map((t) => (
              <View key={t.id} style={styles.row}>
                <IconBubble icon={t.is_debit ? 'arrow-up' : 'arrow-down'} tint={t.is_debit ? 'danger' : 'lime'} size={40} />
                <View style={styles.flex}>
                  <Text style={[styles.rowTitle, { color: t.is_debit ? colors.danger : colors.primary }]}>
                    {formatXAFSigned(t.is_debit ? -Number(t.amount) : Number(t.amount))}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{t.description?.trim() ? t.description : t.transaction_type}</Text>
                </View>
                <Text style={styles.txDate}>{timeAgo(t.created_at)}</Text>
              </View>
            ))
          )
        ) : null}
      </ScrollView>

      {/* Modales */}
      {correcting ? (
        <ContributionCorrectionModal
          contribution={correcting}
          onClose={() => setCorrecting(null)}
          onSubmitted={() => {
            setCorrecting(null);
            contribQ.refetch();
          }}
        />
      ) : null}

      {toppingUp ? (
        <ContributionTopUpModal
          contribution={toppingUp}
          onClose={() => setToppingUp(null)}
          onDone={() => {
            setToppingUp(null);
            contribQ.refetch();
          }}
        />
      ) : null}

      {signing ? (
        <SignatureModal
          visible
          subject={{
            title: 'Bordereau de cotisation',
            memberName: signing.member_name ?? 'Membre',
            amount: formatXAF(signing.paid_amount || signing.expected_amount),
            contextLine: `Cotisation · ${signing.tontine_type_name ?? signing.tontine_type}`,
          }}
          referenceSignatureUrl={refSigUrl}
          signFn={(signature, deviceInfo) => financeApi.signContributionReceipt(signing.id, signature, deviceInfo)}
          onClose={() => { setSigning(null); setRefSigUrl(null); }}
          onSigned={() => contribQ.refetch()}
        />
      ) : null}

      {showLoanForm ? (
        <LoanRequestModal onClose={() => setShowLoanForm(false)} onSaved={() => { setShowLoanForm(false); loansQ.refetch(); }} />
      ) : null}

      {loanAction ? (
        <ApprovalRequestModal
          title={loanAction.title}
          actionType={loanAction.actionType}
          targetId={loanAction.loan.id}
          targetLabel={loanAction.loan.member_name ?? 'Membre'}
          contextSummary={loanAction.contextSummary}
          fields={loanAction.fields}
          onClose={() => setLoanAction(null)}
          onSubmitted={() => { setLoanAction(null); loansQ.refetch(); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function KpiStat({ label, value, tone, full }: { label: string; value: string; tone: 'neutral' | 'success' | 'danger'; full?: boolean }) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.text;
  return (
    <View style={[styles.kpi, full && styles.kpiFull]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function FilterChips({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key || 'all'} onPress={() => onChange(o.key)} style={[styles.filterChip, on && styles.filterChipOn]}>
            <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MiniBtn({ icon, label, tone, onPress }: { icon: any; label: string; tone: 'primary' | 'warning' | 'success' | 'danger'; onPress: () => void }) {
  const c = tone === 'primary' ? colors.primary : tone === 'warning' ? colors.goldAccent : tone === 'danger' ? colors.danger : colors.success;
  const filled = tone === 'primary' || tone === 'success';
  return (
    <Pressable onPress={onPress} style={[styles.mini, filled ? { backgroundColor: c } : { borderWidth: 1.5, borderColor: c }]}>
      <Ionicons name={icon} size={13} color={filled ? colors.white : c} />
      <Text style={[styles.miniText, { color: filled ? colors.white : c }]}>{label}</Text>
    </Pressable>
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

  // KPIs
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  kpiFull: { width: '100%' },
  kpiLabel: { fontSize: font.size.xs, color: colors.textMuted },
  kpiValue: { fontSize: font.size.lg, fontWeight: font.bold, marginTop: 2 },

  // Filtres
  filterRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterChipOn: { backgroundColor: colors.primary },
  filterChipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterChipTextOn: { color: colors.white },

  // Carte cotisation
  cCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  cTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cMember: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  cTontine: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  cStatusCol: { alignItems: 'flex-end', gap: 4 },
  corrPending: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  corrPendingText: { fontSize: 10, color: colors.goldAccent, fontWeight: font.semibold },

  cAmounts: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm },
  cAmountCell: { flex: 1 },
  cAmountLabel: { fontSize: 10, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.3 },
  cAmountVal: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginTop: 1 },
  cPaid: { color: colors.success },
  cDate: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  cActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  miniText: { fontSize: font.size.sm, fontWeight: font.semibold },

  // Boutons d'actions prêts
  loanBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  loanPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill },
  loanPrimaryText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  loanOutlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  loanOutlineText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.size.sm },
  loanGoldBtn: { borderColor: colors.goldAccent },

  // Lignes génériques (prêts / remboursements / transactions)
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  rowMeta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txDate: { fontSize: font.size.xs, color: colors.textLight },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
