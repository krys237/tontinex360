import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, IconBubble } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import type { TreasuryWithdrawal, WithdrawalDebt } from '../../lib/types/finance';
import { financeApi } from '../../lib/api/finance';
import { approvalsApi } from '../../lib/api/approvals';
import type { StatusTone } from '../../components/bureau/StatusChip';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauWithdrawals'>;

const WITHDRAWAL_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente validation', tone: 'warning' },
  applied: { label: 'Appliqué', tone: 'success' },
  rejected: { label: 'Refusé', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'muted' },
};

function errMsg(e: any): string {
  return e?.response?.data?.error ?? e?.response?.data?.detail ?? 'Action impossible pour le moment.';
}

export default function BureauWithdrawalsScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [repaying, setRepaying] = useState<{ withdrawal: TreasuryWithdrawal; debt: WithdrawalDebt } | null>(null);

  const wQ = useQuery({ queryKey: ['bureau', 'withdrawals'], queryFn: () => financeApi.withdrawals() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'withdrawals'] });
    qc.invalidateQueries({ queryKey: ['bureau', 'approvals'] });
  };

  // Filet de sécurité : si la demande d'approbation n'est pas partie à la
  // création (réseau), on peut la re-soumettre — le serveur refuse les doublons.
  const submitApprovalMut = useMutation({
    mutationFn: (w: TreasuryWithdrawal) =>
      approvalsApi.request('treasury.withdraw', w.id, {}, w.reason || 'Retrait de trésorerie'),
    onSuccess: (req) => {
      invalidate();
      Alert.alert('Demande envoyée', 'Le retrait est soumis à la double validation du bureau.', [
        { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const withdrawals = wQ.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={wQ.isRefetching} onRefresh={() => wQ.refetch()} tintColor={colors.primary} />
        }>
        <Text style={styles.intro}>
          Un retrait débite un fonds après double validation du bureau. S'il est « remboursable »,
          la somme est répartie à parts égales entre les membres actifs, qui la remboursent ensuite.
        </Text>

        <RequirePermission bureau>
          <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]} onPress={() => setShowCreate(true)}>
            <Ionicons name="remove-circle-outline" size={20} color={colors.white} />
            <Text style={styles.ctaText}>Nouveau retrait</Text>
          </Pressable>
        </RequirePermission>

        {wQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
        ) : withdrawals.length === 0 ? (
          <Text style={styles.muted}>Aucun retrait pour le moment.</Text>
        ) : (
          withdrawals.map((w) => {
            const st = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, tone: 'muted' as StatusTone };
            const expandable = w.is_repayable && w.status === 'applied';
            const isOpen = expanded === w.id;
            return (
              <Card key={w.id} style={styles.wCard}>
                <Pressable
                  style={styles.wHead}
                  onPress={() => expandable && setExpanded(isOpen ? null : w.id)}
                  disabled={!expandable}>
                  <IconBubble icon="arrow-up-circle-outline" tint={w.status === 'applied' ? 'danger' : 'accent'} size={38} />
                  <View style={styles.flex}>
                    <Text style={styles.wAmount}>{formatXAF(w.amount)}</Text>
                    <Text style={styles.wSub} numberOfLines={1}>
                      {w.source_fund_name ?? 'Fonds général'}
                      {w.is_repayable ? ' · remboursable' : ''}
                    </Text>
                  </View>
                  <View style={styles.wRight}>
                    <StatusChip label={st.label} tone={st.tone} />
                    {expandable ? (
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                    ) : null}
                  </View>
                </Pressable>

                {w.reason ? <Text style={styles.wReason} numberOfLines={2}>{w.reason}</Text> : null}
                <Text style={styles.wMeta}>
                  {w.created_by_name ? `Par ${w.created_by_name} · ` : ''}{timeAgo(w.created_at)}
                </Text>

                {w.status === 'pending' ? (
                  <RequirePermission bureau>
                    <Pressable
                      style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
                      onPress={() => submitApprovalMut.mutate(w)}
                      disabled={submitApprovalMut.isPending}>
                      {submitApprovalMut.isPending ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.submitBtnText}>Soumettre à validation</Text>
                      )}
                    </Pressable>
                  </RequirePermission>
                ) : null}

                {isOpen ? (
                  <DebtsPanel withdrawal={w} onRepay={(debt) => setRepaying({ withdrawal: w, debt })} />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {showCreate ? (
        <CreateWithdrawalModal
          onClose={() => setShowCreate(false)}
          onDone={(req) => {
            setShowCreate(false);
            invalidate();
            if (req) {
              Alert.alert('Retrait soumis', 'La demande est partie en double validation du bureau.', [
                { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
                { text: 'OK' },
              ]);
            } else {
              Alert.alert(
                'Retrait créé',
                "La demande de validation n'a pas pu être envoyée — utilisez « Soumettre à validation » sur le retrait.",
              );
            }
          }}
        />
      ) : null}

      {repaying ? (
        <RepayDebtModal
          withdrawal={repaying.withdrawal}
          debt={repaying.debt}
          onClose={() => setRepaying(null)}
          onDone={(remaining) => {
            setRepaying(null);
            qc.invalidateQueries({ queryKey: ['bureau', 'withdrawal', repaying.withdrawal.id, 'debts'] });
            qc.invalidateQueries({ queryKey: ['bureau', 'withdrawals'] });
            qc.invalidateQueries({ queryKey: ['bureau', 'tontine-balances'] });
            Alert.alert(
              'Remboursement enregistré',
              Number(remaining) > 0
                ? `Reste dû pour ce membre : ${formatXAF(remaining)}.`
                : 'La part de ce membre est entièrement remboursée.',
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** Parts dues par membre (retrait remboursable appliqué). */
function DebtsPanel({
  withdrawal,
  onRepay,
}: {
  withdrawal: TreasuryWithdrawal;
  onRepay: (debt: WithdrawalDebt) => void;
}) {
  const q = useQuery({
    queryKey: ['bureau', 'withdrawal', withdrawal.id, 'debts'],
    queryFn: () => financeApi.withdrawalDebts(withdrawal.id),
  });

  if (q.isLoading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />;
  const debts = q.data ?? [];
  if (debts.length === 0) return <Text style={styles.muted}>Aucune part à rembourser.</Text>;

  const totalOutstanding = debts.reduce((s, d) => s + Number(d.outstanding), 0);

  return (
    <View style={styles.debts}>
      <Text style={styles.debtsTitle}>
        Parts des membres · reste dû {formatXAF(totalOutstanding)}
      </Text>
      {debts.map((d) => {
        const outstanding = Number(d.outstanding) || 0;
        return (
          <View key={d.membership} style={styles.debtRow}>
            <View style={styles.flex}>
              <Text style={styles.debtName} numberOfLines={1}>{d.member_name}</Text>
              <Text style={styles.debtMeta}>
                Part {formatXAF(d.share)} · remboursé {formatXAF(d.repaid)}
              </Text>
            </View>
            {outstanding > 0 ? (
              <RequirePermission bureau>
                <Pressable style={({ pressed }) => [styles.repayBtn, pressed && { opacity: 0.9 }]} onPress={() => onRepay(d)}>
                  <Text style={styles.repayBtnText}>Rembourser</Text>
                </Pressable>
              </RequirePermission>
            ) : (
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Création d'un retrait puis envoi automatique en double validation. */
function CreateWithdrawalModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (approvalRequest: { id: string } | null) => void;
}) {
  const [sourceFund, setSourceFund] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [repayable, setRepayable] = useState(false);

  const fundsQ = useQuery({
    queryKey: ['bureau', 'tontine-balances'],
    queryFn: () => financeApi.tontineBalances(),
  });

  const mut = useMutation({
    mutationFn: async () => {
      const w = await financeApi.createWithdrawal({
        source_fund: sourceFund,
        amount: Number(amount),
        reason: reason.trim(),
        is_repayable: repayable,
      });
      // Le retrait existe ; la demande d'approbation peut échouer séparément
      // (réseau) — on distingue les deux issues pour l'appelant.
      try {
        return await approvalsApi.request('treasury.withdraw', w.id, {}, reason.trim());
      } catch {
        return null;
      }
    },
    onSuccess: (req) => onDone(req),
    onError: (e: any) => Alert.alert('Erreur', errMsg(e)),
  });

  const funds = fundsQ.data?.funds ?? [];
  const valid = Number(amount) > 0 && reason.trim().length >= 5;
  const selectedFund = funds.find((f) => f.tontine_type_id === sourceFund);
  const insufficient = selectedFund ? Number(selectedFund.balance) < Number(amount || 0) : false;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Nouveau retrait</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Fonds débité</Text>
            <View style={{ gap: 8 }}>
              <FundOption
                selected={sourceFund === null}
                onPress={() => setSourceFund(null)}
                name="Fonds général"
                sub="Non affecté"
              />
              {fundsQ.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                funds.map((f) => (
                  <FundOption
                    key={f.tontine_type_id}
                    selected={sourceFund === f.tontine_type_id}
                    onPress={() => setSourceFund(f.tontine_type_id)}
                    name={f.name}
                    sub={`Solde : ${formatXAF(f.balance)}`}
                  />
                ))
              )}
            </View>

            <TextField
              label="Montant (XAF) *"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              helper={insufficient ? 'Solde du fonds insuffisant : le débit sera refusé à l\'application.' : undefined}
            />

            <TextField
              label="Motif * (min. 5 caractères)"
              value={reason}
              onChangeText={setReason}
              placeholder="Ex : achat de chaises pour la salle"
              multiline
            />

            <Pressable style={styles.toggleRow} onPress={() => setRepayable((v) => !v)}>
              <Ionicons
                name={repayable ? 'checkbox' : 'square-outline'}
                size={22}
                color={repayable ? colors.primary : colors.textMuted}
              />
              <View style={styles.flex}>
                <Text style={styles.toggleLabel}>Remboursable par les membres</Text>
                <Text style={styles.toggleSub}>La somme sera répartie à parts égales entre les membres actifs.</Text>
              </View>
            </Pressable>

            <Text style={styles.hint}>
              L'argent ne bouge pas tout de suite : le retrait exige votre validation et celle d'un
              autre membre du bureau.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && { opacity: 0.5 }]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}>
              {mut.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>Créer et soumettre</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Enregistrement du remboursement de la part d'un membre. */
function RepayDebtModal({
  withdrawal,
  debt,
  onClose,
  onDone,
}: {
  withdrawal: TreasuryWithdrawal;
  debt: WithdrawalDebt;
  onClose: () => void;
  onDone: (remaining: string) => void;
}) {
  const outstanding = Number(debt.outstanding) || 0;
  const [amount, setAmount] = useState(String(outstanding || ''));

  const mut = useMutation({
    mutationFn: () =>
      financeApi.repayWithdrawal(withdrawal.id, { membership: debt.membership, amount: Number(amount) }),
    onSuccess: (res) => onDone(res.remaining),
    onError: (e: any) => Alert.alert('Erreur', errMsg(e)),
  });

  const valid = Number(amount) > 0 && Number(amount) <= outstanding;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.centerOverlay}>
        <View style={styles.centerCard}>
          <Text style={styles.sheetTitle}>Rembourser la part</Text>
          <Text style={styles.repayContext}>
            {debt.member_name} · reste dû {formatXAF(outstanding)}
          </Text>
          <TextField
            label="Montant reçu (XAF) *"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            helper={Number(amount) > outstanding ? `Plafonné au reste dû (${formatXAF(outstanding)}).` : undefined}
          />
          <Text style={styles.hint}>Le montant recrédite le fonds débité par le retrait.</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && { opacity: 0.5 }]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}>
              {mut.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FundOption({
  selected,
  onPress,
  name,
  sub,
}: {
  selected: boolean;
  onPress: () => void;
  name: string;
  sub: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.fundRow, selected && styles.fundRowOn]}>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.primary : colors.textMuted}
      />
      <View style={styles.flex}>
        <Text style={styles.fundName}>{name}</Text>
        <Text style={styles.fundSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  intro: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: font.size.xs * 1.5 },
  muted: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 50,
  },
  ctaText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },

  wCard: { borderRadius: radius.lg, gap: 8, ...cardShadow },
  wHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  wSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  wRight: { alignItems: 'flex-end', gap: 4 },
  wReason: { fontSize: font.size.sm, color: colors.text },
  wMeta: { fontSize: font.size.xs, color: colors.textLight },

  submitBtn: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  submitBtnText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },

  debts: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm, gap: 6 },
  debtsTitle: { fontSize: font.size.xs, fontWeight: font.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  debtName: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  debtMeta: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  repayBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  repayBtnText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.primary },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '92%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },

  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  centerCard: { backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.x2, gap: 10 },
  repayContext: { fontSize: font.size.sm, color: colors.textMuted },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  fundRowOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  fundName: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  fundSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  toggleLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  toggleSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  hint: { fontSize: font.size.xs, color: colors.textLight },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
});
