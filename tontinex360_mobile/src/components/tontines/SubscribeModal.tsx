import React, { useMemo, useState } from 'react';
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
import { tontinesApi } from '../../lib/api/tontines';
import type { TontineType } from '../../lib/types/tontine';
import type { Cycle } from '../../lib/types/cycle';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export default function SubscribeModal({
  visible,
  onClose,
  onSubscribed,
  cycle,
  types,
  membershipId,
}: {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
  cycle: Cycle | null;
  types: TontineType[];
  membershipId?: string;
}) {
  const [typeId, setTypeId] = useState<string | null>(types[0]?.id ?? null);
  const selected = useMemo(() => types.find((t) => t.id === typeId) ?? null, [types, typeId]);

  const [shares, setShares] = useState('1');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset rate when the selected type changes.
  React.useEffect(() => {
    if (!selected) return;
    if (selected.rate_mode === 'fixed') setRate(String(selected.fixed_rate ?? ''));
    else if (selected.rate_mode === 'range') setRate(String(selected.min_rate ?? ''));
    else setRate('');
  }, [selected]);

  const sharesNum = Math.max(1, parseInt(shares || '1', 10) || 1);
  const rateNum = parseFloat((rate || '0').replace(',', '.')) || 0;
  const engagement = sharesNum * rateNum;
  const maxShares = selected?.max_shares_per_member ?? null;

  const rateHint = (() => {
    if (!selected) return '';
    if (selected.rate_mode === 'fixed') return 'Montant fixe par part';
    if (selected.rate_mode === 'range')
      return `Plage : ${formatNumber(selected.min_rate ?? 0)} – ${formatNumber(selected.max_rate ?? 0)} ${selected.currency || 'XAF'}`;
    return 'Montant libre';
  })();

  const submit = async () => {
    setError(null);
    if (!selected) return setError('Choisissez une tontine.');
    if (!cycle) return setError('Aucun cycle en cours.');
    if (!membershipId) return setError('Adhésion introuvable.');
    if (maxShares && sharesNum > maxShares) return setError(`Maximum ${maxShares} part(s).`);
    if (selected.rate_mode === 'range') {
      const mn = Number(selected.min_rate ?? 0);
      const mx = Number(selected.max_rate ?? Infinity);
      if (rateNum < mn || rateNum > mx) return setError(`Le taux doit être entre ${formatNumber(mn)} et ${formatNumber(mx)}.`);
    }
    if (rateNum <= 0) return setError('Indiquez un taux par part valide.');

    setLoading(true);
    try {
      await tontinesApi.createSubscription({
        membership: membershipId,
        tontine_type: selected.id,
        cycle: cycle.id,
        num_shares: sharesNum,
        rate_per_share: rateNum,
      });
      onSubscribed();
      onClose();
    } catch (e: any) {
      const data = e?.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Souscription échouée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Souscrire à une tontine</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Cycle */}
            <Text style={styles.label}>Cycle (en cours)</Text>
            <View style={styles.readonly}>
              <Text style={styles.readonlyText}>{cycle?.name ?? '—'}</Text>
            </View>

            {/* Tontine selection */}
            <Text style={styles.label}>
              Tontine <Text style={styles.req}>*</Text>
            </Text>
            {types.length === 0 ? (
              <Text style={styles.empty}>Aucune tontine disponible pour ce cycle.</Text>
            ) : (
              types.map((t) => {
                const active = t.id === typeId;
                return (
                  <Pressable key={t.id} onPress={() => setTypeId(t.id)} style={[styles.option, active && styles.optionActive]}>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? colors.primary : colors.textLight}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.optionName}>{t.name}</Text>
                      {t.description ? (
                        <Text style={styles.optionDesc} numberOfLines={1}>
                          {t.description}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Parts */}
            <Text style={styles.label}>
              Parts <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.placeholder}
            />
            {maxShares ? <Text style={styles.hint}>Max : {maxShares}</Text> : null}

            {/* Rate */}
            <Text style={styles.label}>
              Taux / part ({selected?.currency || 'XAF'}) <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, selected?.rate_mode === 'fixed' && styles.inputDisabled]}
              value={rate}
              onChangeText={setRate}
              editable={selected?.rate_mode !== 'fixed'}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
            {rateHint ? <Text style={styles.hint}>{rateHint}</Text> : null}

            {/* Engagement */}
            <View style={styles.engagement}>
              <Text style={styles.engLabel}>ENGAGEMENT PAR SÉANCE</Text>
              <Text style={styles.engValue}>{formatNumber(engagement)} XAF</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose} disabled={loading}>
              <Text style={styles.btnGhostText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnPrimaryText}>Souscrire</Text>}
            </Pressable>
          </View>
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
  readonly: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center' },
  readonlyText: { fontSize: font.size.base, color: colors.text },
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
  inputDisabled: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  hint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4 },
  empty: { fontSize: font.size.sm, color: colors.textMuted, paddingVertical: 8 },
  engagement: { backgroundColor: colors.greenBg, borderRadius: radius.lg, padding: 14, marginTop: spacing.lg },
  engLabel: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.4 },
  engValue: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary, marginTop: 2 },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: spacing.lg },
  btn: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  btnGhostText: { color: colors.textMuted, fontWeight: font.semibold, fontSize: font.size.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.md },
  btnDisabled: { opacity: 0.6 },
});
