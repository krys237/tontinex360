import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import MemberPicker from '../../components/bureau/MemberPicker';
import type { BureauStackParamList } from '../../navigation/types';
import { sanctionsApi, type SanctionStatus } from '../../lib/api/sanctions';
import { cyclesApi } from '../../lib/api/cycles';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSanctionApply'>;
type Rt = RouteProp<BureauStackParamList, 'BureauSanctionApply'>;

const STATUSES: { key: SanctionStatus; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'paid', label: 'Payée' },
  { key: 'waived', label: 'Graciée' },
  { key: 'contested', label: 'Contestée' },
];
const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', paid: 'Payée', waived: 'Graciée', contested: 'Contestée',
};

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const first = Object.values(d)[0];
    if (Array.isArray(first)) return String(first[0]);
    return d.detail ?? d.error ?? JSON.stringify(d);
  }
  return 'Action impossible pour le moment.';
}

export default function BureauSanctionApplyScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const params = useRoute<Rt>().params;
  const presetType = params?.typeId;
  const editId = params?.id;
  const isEdit = !!editId;

  const [type, setType] = useState<string | null>(presetType ?? null);
  const [member, setMember] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<SanctionStatus>('pending');
  const [session, setSession] = useState<string>(''); // '' = aucune
  const [reason, setReason] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Modifier la sanction' : 'Appliquer une sanction' });
  }, [navigation, isEdit]);

  const typesQ = useQuery({ queryKey: ['bureau', 'sanction-types'], queryFn: () => sanctionsApi.types({ is_active: true }) });
  const sessionsQ = useQuery({ queryKey: ['bureau', 'sessions', 'all'], queryFn: () => cyclesApi.sessions() });
  const sanctionQ = useQuery({ queryKey: ['bureau', 'sanction', editId], queryFn: () => sanctionsApi.get(editId!), enabled: isEdit });

  const types = typesQ.data ?? [];
  const sessions = sessionsQ.data ?? [];

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (sanctionQ.data && !loaded) {
      const s = sanctionQ.data;
      setType(s.sanction_type);
      setMember({ id: s.membership, name: s.member_name ?? 'Membre' });
      setAmount(String(s.amount ?? ''));
      setStatus(s.status);
      setSession(s.session ?? '');
      setReason(s.reason ?? '');
      setLoaded(true);
    }
  }, [sanctionQ.data, loaded]);

  // Préremplit le montant depuis le type choisi (création uniquement).
  const onPickType = (id: string) => {
    setType(id);
    if (isEdit) return;
    const t = types.find((x) => x.id === id);
    if (!amountTouched && t?.default_amount != null) setAmount(String(t.default_amount));
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        // ⚠️ montant/statut sont protégés (→ Corriger). On n'envoie QUE les champs libres.
        return sanctionsApi.update(editId!, {
          sanction_type: type!,
          membership: member!.id,
          session: session || null,
          reason: reason.trim(),
        });
      }
      return sanctionsApi.create({
        sanction_type: type!,
        membership: member!.id,
        amount: amount.trim() ? Number(amount) : 0,
        status,
        session: session || null,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'sanctions'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['bureau', 'sanction', editId] });
      Alert.alert(isEdit ? 'Sanction modifiée' : 'Sanction appliquée', 'Les modifications ont été enregistrées.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canSubmit = useMemo(
    () => (isEdit ? !!type && !!member : !!type && !!member && !!amount.trim()),
    [isEdit, type, member, amount],
  );

  if (isEdit && sanctionQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.label}>Type *</Text>
          <View style={styles.chips}>
            {types.map((t) => {
              const on = type === t.id;
              return (
                <Pressable key={t.id} onPress={() => onPickType(t.id)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.name}</Text>
                </Pressable>
              );
            })}
            {types.length === 0 ? <Text style={styles.hint}>Aucun type. Créez-en un d'abord.</Text> : null}
          </View>

          <Text style={styles.label}>Membre *</Text>
          <MemberPicker value={member} onChange={setMember} />

          {isEdit ? (
            /* Montant + statut sont protégés : lecture seule + accès à Corriger */
            <Pressable style={styles.lockedBox} onPress={() => navigation.navigate('BureauSanctionCorrect', { id: editId! })}>
              <Ionicons name="lock-closed" size={16} color={colors.goldAccent} />
              <View style={styles.flex}>
                <Text style={styles.lockedText}>
                  Montant : <Text style={styles.lockedStrong}>{formatXAF(amount)}</Text> · Statut : <Text style={styles.lockedStrong}>{STATUS_LABEL[status] ?? status}</Text>
                </Text>
                <Text style={styles.lockedHint}>Touchez pour corriger (soumis à l'approbation du bureau).</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </Pressable>
          ) : (
            <>
              <TextField
                label="Montant (XAF) *"
                value={amount}
                onChangeText={(t) => { setAmount(t); setAmountTouched(true); }}
                placeholder="Ex : 500"
                keyboardType="numeric"
              />
              <Text style={styles.label}>Statut</Text>
              <View style={styles.chips}>
                {STATUSES.map((s) => {
                  const on = status === s.key;
                  return (
                    <Pressable key={s.key} onPress={() => setStatus(s.key)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>Séance (optionnel)</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setSession('')} style={[styles.chip, !session && styles.chipOn]}>
              <Text style={[styles.chipText, !session && styles.chipTextOn]}>Aucune</Text>
            </Pressable>
            {sessions.map((s) => {
              const on = session === s.id;
              return (
                <Pressable key={s.id} onPress={() => setSession(s.id)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    N°{s.session_number ?? '–'} · {formatDateFr(s.date, false)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField label="Motif" value={reason} onChangeText={setReason} placeholder="Raison de la sanction" multiline />

          <PrimaryButton
            title={isEdit ? 'Enregistrer' : 'Appliquer la sanction'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!canSubmit}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },
  hint: { fontSize: font.size.sm, color: colors.textMuted },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginBottom: 14 },
  lockedText: { fontSize: font.size.sm, color: '#8A6D1E' },
  lockedStrong: { fontWeight: font.bold, color: '#7A5B10' },
  lockedHint: { fontSize: font.size.xs, color: '#8A6D1E', marginTop: 2 },
});
