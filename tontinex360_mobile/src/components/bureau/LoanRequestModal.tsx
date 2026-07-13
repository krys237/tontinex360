import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation } from '@tanstack/react-query';

import { TextField } from '../ui';
import MemberPicker from './MemberPicker';
import { DateField, isValidDate } from './DateTimeFields';
import { financeApi } from '../../lib/api/finance';
import { membersApi } from '../../lib/api/members';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF } from '../../lib/utils/format';

/** Convertit une date masquée YYYY-MM-DD → ISO date (déjà au bon format). */
export default function LoanRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { membership, isPresident, canAny } = usePermissions();
  const myId = membership?.id ?? '';
  const myName = membership ? `${membership.user?.first_name ?? ''} ${membership.user?.last_name ?? ''}`.trim() : 'Moi-même';
  const canChooseMember = isPresident || canAny(['*', 'finance.*', 'finance.loans']);

  const [beneficiary, setBeneficiary] = useState<{ id: string; name: string } | null>(
    myId ? { id: myId, name: `Moi-même — ${myName}` } : null,
  );
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [guarantors, setGuarantors] = useState<string[]>([]);
  const [error, setError] = useState('');

  const settingsQ = useQuery({ queryKey: ['loan-settings'], queryFn: () => financeApi.getLoanSettings(), retry: false });
  const capacityQ = useQuery({ queryKey: ['loan-capacity'], queryFn: () => financeApi.getLoanCapacity(), retry: false });
  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'active'], queryFn: () => membersApi.list({ status: 'active' }) });

  const beneficiaryId = beneficiary?.id || myId;
  const coverageQ = useQuery({
    queryKey: ['loan-coverage', beneficiaryId],
    queryFn: () => financeApi.getLoanCoverage(beneficiaryId),
    enabled: !!beneficiaryId,
    retry: false,
  });

  // Pré-remplit le taux par défaut quand la config arrive.
  useEffect(() => {
    if (settingsQ.data && rate === '') setRate(String(settingsQ.data.default_interest_rate));
  }, [settingsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = Number(capacityQ.data?.available ?? 0);
  const amountNum = Number(amount || 0);
  const rateNum = Number(rate || 0);
  const total = amountNum > 0 ? amountNum + (amountNum * rateNum) / 100 : 0;
  const coverageAvailable = Number(coverageQ.data?.available_coverage ?? 0);
  const needsGuarantors = amountNum > coverageAvailable && coverageAvailable >= 0;
  const guarantorsRequired = settingsQ.data?.require_guarantor || needsGuarantors;
  const overCapacity = !!capacityQ.data && amountNum > available;

  const mut = useMutation({
    mutationFn: async () => {
      if (!isValidDate(dueDate)) throw { response: { data: { detail: "L'échéance de remboursement est obligatoire (AAAA-MM-JJ)." } } };
      const loan = await financeApi.createLoan({
        membership: beneficiaryId,
        amount: amountNum,
        interest_rate: rateNum,
        total_due: total,
        due_date: dueDate,
        purpose,
        status: 'pending',
      } as any);
      if (guarantors.length > 0) await financeApi.attachGuarantors(loan.id, guarantors);
      return loan;
    },
    onSuccess: onSaved,
    onError: (e: any) => {
      const d = e?.response?.data;
      setError(typeof d === 'string' ? d : d?.detail ?? 'Erreur lors de la création du prêt.');
    },
  });

  const valid =
    !!beneficiaryId && amountNum > 0 && purpose.trim().length > 0 && isValidDate(dueDate) && !overCapacity &&
    (!guarantorsRequired || guarantors.length > 0);

  const otherMembers = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.id !== beneficiaryId),
    [membersQ.data, beneficiaryId],
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Demande de prêt</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            {error ? <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View> : null}

            {canChooseMember ? (
              <MemberPicker label="Bénéficiaire *" value={beneficiary} onChange={setBeneficiary} />
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Bénéficiaire</Text>
                <View style={styles.fixedBox}><Text style={styles.fixedText}>{myName}</Text></View>
              </View>
            )}

            <TextField
              label="Montant demandé (XAF) *"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              placeholder="100000"
              keyboardType="number-pad"
            />
            {capacityQ.data ? (
              <Text style={styles.hint}>
                Capacité disponible : <Text style={[styles.bold, { color: available > 0 ? colors.success : colors.danger }]}>{formatXAF(available)}</Text>
                {'  '}(caisse {formatXAF(Number(capacityQ.data.total_treasury))} − réserve {capacityQ.data.buffer_pct}% − encours {formatXAF(Number(capacityQ.data.outstanding_loans))})
              </Text>
            ) : null}
            {overCapacity ? <Text style={styles.warn}>⚠ Montant supérieur à la capacité actuelle de la caisse.</Text> : null}

            <View style={styles.row2}>
              <TextField
                label={`Taux (%)${settingsQ.data ? ` ${settingsQ.data.min_interest_rate}–${settingsQ.data.max_interest_rate}` : ''}`}
                value={rate}
                onChangeText={(t) => setRate(t.replace(/[^0-9.]/g, ''))}
                placeholder="5"
                keyboardType="decimal-pad"
                containerStyle={styles.flex}
              />
              <DateField label="Échéance *" value={dueDate} onChangeText={setDueDate} containerStyle={styles.flex} />
            </View>
            {settingsQ.data && rateNum === settingsQ.data.default_interest_rate ? (
              <Text style={styles.okHint}>↳ Taux par défaut de l'association</Text>
            ) : null}

            <TextField
              label="Motif / objet *"
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Frais de scolarité, achat équipement…"
              multiline
            />

            {total > 0 ? (
              <View style={styles.totalBox}>
                <Text style={styles.totalText}>Total à rembourser : <Text style={styles.bold}>{formatXAF(total)}</Text>
                  {rateNum > 0 ? <Text style={styles.totalSub}>  (intérêt {formatXAF(total - amountNum)})</Text> : null}
                </Text>
              </View>
            ) : null}

            {coverageQ.data ? (
              <View style={[styles.covBox, needsGuarantors ? styles.covWarn : styles.covOk]}>
                <Text style={[styles.covText, { color: needsGuarantors ? '#92702A' : colors.primary }]}>
                  <Text style={styles.bold}>Couverture naturelle : </Text>{formatXAF(coverageAvailable)}
                </Text>
                {needsGuarantors ? (
                  <Text style={styles.covSub}>Le montant dépasse votre couverture. Désignez un ou plusieurs garants.</Text>
                ) : (
                  <Text style={[styles.covSub, { color: colors.primary }]}>Votre couverture suffit, garant non obligatoire.</Text>
                )}
              </View>
            ) : null}

            {guarantorsRequired || guarantors.length > 0 ? (
              <View>
                <Text style={styles.fieldLabel}>Garants{guarantorsRequired ? ' *' : ''}</Text>
                <View style={styles.guarWrap}>
                  {otherMembers.map((m) => {
                    const on = guarantors.includes(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setGuarantors((g) => (on ? g.filter((x) => x !== m.id) : [...g, m.id]))}
                        style={[styles.guarChip, on && styles.guarChipOn]}
                      >
                        {on ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                        <Text style={[styles.guarChipText, on && styles.guarChipTextOn]}>{m.user_name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>Chaque garant devra accepter sa désignation. Un seul refus annule la demande.</Text>
              </View>
            ) : null}

            <Text style={styles.note}>Votre demande sera examinée par le bureau. Vous serez notifié de la décision.</Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && styles.btnDisabled]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}
            >
              {mut.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnPrimaryText}>Soumettre la demande</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.lg, gap: spacing.sm, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  bold: { fontWeight: font.bold },
  flex: { flex: 1 },
  row2: { flexDirection: 'row', gap: spacing.sm },

  errBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md },
  errText: { fontSize: font.size.sm, color: colors.danger },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginBottom: 6 },
  fixedBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  fixedText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.semibold },

  hint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: -spacing.xs },
  okHint: { fontSize: font.size.xs, color: colors.primary, marginTop: -spacing.xs },
  warn: { fontSize: font.size.xs, color: colors.danger, marginTop: -spacing.xs },

  totalBox: { backgroundColor: colors.blue[100], borderRadius: radius.md, padding: spacing.md },
  totalText: { fontSize: font.size.sm, color: colors.blue[600] },
  totalSub: { fontSize: font.size.xs, color: colors.blue[600] },

  covBox: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1, gap: 2 },
  covOk: { backgroundColor: colors.greenBg, borderColor: colors.greenBgDeep },
  covWarn: { backgroundColor: colors.goldSoft, borderColor: colors.gold.beige },
  covText: { fontSize: font.size.sm },
  covSub: { fontSize: font.size.xs, color: '#92702A' },

  guarWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  guarChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  guarChipOn: { backgroundColor: colors.primary },
  guarChipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  guarChipTextOn: { color: colors.white },

  note: { fontSize: font.size.xs, color: colors.textLight, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
