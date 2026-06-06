import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { financeApi } from '../../lib/api/finance';
import { cyclesApi } from '../../lib/api/cycles';
import type { Session } from '../../lib/types/cycle';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2026-06-19" -> "19 juin 2026". */
function frDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr;
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/** today + n months, as YYYY-MM-DD. */
function addMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const DURATIONS = [
  { label: '1 mois', months: 1 },
  { label: '3 mois', months: 3 },
  { label: '6 mois', months: 6 },
  { label: '12 mois', months: 12 },
];

// Libellés FR des champs renvoyés par le back, pour des erreurs lisibles.
const FIELD_LABELS: Record<string, string> = {
  membership: 'Adhésion',
  amount: 'Montant',
  interest_rate: "Taux d'intérêt",
  total_due: 'Montant à rembourser',
  due_date: 'Échéance',
  session_granted: "Séance d'octroi",
  non_field_errors: 'Erreur',
  detail: 'Erreur',
};

/** Met en forme une erreur DRF en conservant le nom du champ concerné. */
function formatApiError(data: unknown): string {
  if (!data) return 'Échec de la demande de prêt.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.join(' ');
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    const parts: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const label = FIELD_LABELS[key] ?? key;
      const msg = Array.isArray(val)
        ? val.join(' ')
        : typeof val === 'object' && val
          ? JSON.stringify(val)
          : String(val);
      parts.push(`${label} : ${msg}`);
    }
    if (parts.length) return parts.join('\n');
  }
  return 'Échec de la demande de prêt.';
}

export default function LoanRequestModal({
  visible,
  onClose,
  onCreated,
  membershipId,
  defaultInterestRate = 5,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  membershipId?: string;
  defaultInterestRate?: number;
}) {
  const cycleQ = useQuery({ queryKey: ['cycle', 'current'], queryFn: cyclesApi.current, enabled: visible });
  const cycle = cycleQ.data ?? null;
  const sessionsQ = useQuery({
    queryKey: ['cycle', 'sessions', cycle?.id ?? null],
    queryFn: () => cyclesApi.sessions({ status: 'scheduled', ...(cycle ? { cycle: cycle.id } : {}) }),
    enabled: visible && !!cycle,
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const sessions: Session[] = useMemo(
    () => [...(sessionsQ.data ?? [])].filter((s) => !!s.date).sort((a, b) => a.date.localeCompare(b.date)),
    [sessionsQ.data],
  );
  const defaultSession = useMemo(
    () => sessions.find((s) => s.date >= todayISO) ?? sessions[0] ?? null,
    [sessions, todayISO],
  );

  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState(String(defaultInterestRate));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // (Re)initialise when opened or when the default session resolves.
  useEffect(() => {
    if (!visible) return;
    setSessionId((prev) => prev ?? defaultSession?.id ?? null);
  }, [visible, defaultSession]);

  const reset = () => {
    setAmount('');
    setRate(String(defaultInterestRate));
    setSessionId(null);
    setMonths(3);
    setError(null);
    setDone(false);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const amountNum = parseFloat((amount || '0').replace(/\s/g, '').replace(',', '.')) || 0;
  const rateNum = parseFloat((rate || '0').replace(',', '.')) || 0;
  const dueDate = addMonthsISO(months);
  const totalDue = amountNum * (1 + rateNum / 100);

  const submit = async () => {
    setError(null);
    if (!membershipId) return setError('Adhésion introuvable.');
    if (amountNum <= 0) return setError('Indiquez un montant valide.');
    if (rateNum < 0) return setError("Le taux d'intérêt est invalide.");
    if (!sessionId) return setError('Sélectionnez une séance.');

    setLoading(true);
    try {
      await financeApi.createLoan({
        membership: membershipId,
        amount: amountNum,
        interest_rate: rateNum,
        total_due: Math.round(totalDue),
        due_date: dueDate,
        session_granted: sessionId,
      });
      setDone(true);
      onCreated?.();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const sessionsLoading = cycleQ.isLoading || (!!cycle && sessionsQ.isLoading);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Demander un prêt</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {done ? (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={34} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>Demande envoyée</Text>
              <Text style={styles.successText}>
                Votre demande de prêt de {formatNumber(amountNum)} XAF a été transmise au bureau.
                Vous serez notifié de la décision.
              </Text>
              <Pressable style={[styles.btn, styles.btnPrimary, styles.successBtn]} onPress={close}>
                <Text style={styles.btnPrimaryText}>Fermer</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Amount */}
                <Text style={styles.label}>
                  Montant souhaité (XAF) <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="Ex : 25 000"
                  placeholderTextColor={colors.placeholder}
                />

                {/* Interest rate */}
                <Text style={styles.label}>
                  Taux d'intérêt (%) <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={colors.placeholder}
                />
                <Text style={styles.hint}>Taux appliqué par l'association (modifiable selon le règlement).</Text>

                {/* Due date via durations */}
                <Text style={styles.label}>
                  Échéance <Text style={styles.req}>*</Text>
                </Text>
                <View style={styles.chips}>
                  {DURATIONS.map((d) => {
                    const active = d.months === months;
                    return (
                      <Pressable
                        key={d.months}
                        onPress={() => setMonths(d.months)}
                        style={[styles.chip, active && styles.chipActive]}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>Remboursement attendu avant le {frDate(dueDate)}.</Text>

                {/* Session granted */}
                <Text style={styles.label}>
                  Séance d'octroi <Text style={styles.req}>*</Text>
                </Text>
                {sessionsLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
                ) : sessions.length === 0 ? (
                  <Text style={styles.empty}>Aucune séance planifiée pour le moment.</Text>
                ) : (
                  sessions.map((s) => {
                    const active = s.id === sessionId;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setSessionId(s.id)}
                        style={[styles.option, active && styles.optionActive]}>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={active ? colors.primary : colors.textLight}
                        />
                        <View style={styles.flex}>
                          <Text style={styles.optionName}>Séance N°{s.session_number}</Text>
                          <Text style={styles.optionDesc} numberOfLines={1}>
                            {frDate(s.date)}
                            {s.location ? ` · ${s.location}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {/* Repayment preview */}
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>MONTANT À REMBOURSER (estimé)</Text>
                  <Text style={styles.previewValue}>{formatNumber(totalDue)} XAF</Text>
                  <Text style={styles.previewSub}>
                    {formatNumber(amountNum)} XAF + {rateNum}% d'intérêt
                  </Text>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}
              </ScrollView>

              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={close} disabled={loading}>
                  <Text style={styles.btnGhostText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                  onPress={submit}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Envoyer la demande</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.x2,
    maxHeight: '90%',
  },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  label: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary, marginTop: spacing.md, marginBottom: 6 },
  req: { color: colors.danger },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    fontSize: font.size.base,
    color: colors.textStrong,
  },
  hint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4 },
  empty: { fontSize: font.size.sm, color: colors.textMuted, paddingVertical: 8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  chipText: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.textMuted },
  chipTextActive: { color: colors.primary, fontWeight: font.semibold },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  optionName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  optionDesc: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  preview: { backgroundColor: colors.greenBg, borderRadius: radius.lg, padding: 14, marginTop: spacing.lg },
  previewLabel: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.4 },
  previewValue: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary, marginTop: 2 },
  previewSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },

  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: spacing.lg },
  btn: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  btnGhostText: { color: colors.textMuted, fontWeight: font.semibold, fontSize: font.size.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.md },
  btnDisabled: { opacity: 0.6 },

  success: { alignItems: 'center', paddingVertical: spacing.lg },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  successText: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: font.size.sm * 1.45,
    paddingHorizontal: spacing.md,
  },
  successBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
