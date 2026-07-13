import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { sanctionsApi, type SanctionStatus } from '../../lib/api/sanctions';
import { useApprovalAction } from '../../lib/hooks/use-approval-action';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSanctionCorrect'>;
type Rt = RouteProp<BureauStackParamList, 'BureauSanctionCorrect'>;

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', paid: 'Payée', waived: 'Graciée', contested: 'Contestée',
};
const STATUSES: { key: SanctionStatus; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'paid', label: 'Payée' },
  { key: 'waived', label: 'Graciée' },
  { key: 'contested', label: 'Contestée' },
];

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  return d?.detail ?? d?.error ?? (d ? JSON.stringify(d) : 'Action impossible pour le moment.');
}

export default function BureauSanctionCorrectScreen() {
  const id = useRoute<Rt>().params.id;
  const navigation = useNavigation<Nav>();

  const [newAmount, setNewAmount] = useState('');
  const [newStatus, setNewStatus] = useState<SanctionStatus | ''>('');
  const [reason, setReason] = useState('');

  const q = useQuery({ queryKey: ['bureau', 'sanction', id], queryFn: () => sanctionsApi.get(id) });

  const submit = useApprovalAction({
    onSuccess: (req) => {
      Alert.alert('Soumis au bureau', 'La correction requiert la validation du bureau (Président + 1 membre).', [
        { text: 'Voir la demande', onPress: () => navigation.replace('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const onSubmit = () => {
    if (reason.trim().length < 5) { Alert.alert('Motif requis', 'Indiquez un motif (min 5 caractères).'); return; }
    const payload: Record<string, any> = {};
    if (newAmount.trim()) payload.amount = Number(newAmount);
    if (newStatus) payload.status = newStatus;
    if (Object.keys(payload).length === 0) {
      Alert.alert('Rien à corriger', 'Renseignez un nouveau montant et/ou un nouveau statut.');
      return;
    }
    submit.mutate({ action: 'sanction.correction', targetId: id, payload, reason: reason.trim() });
  };

  const s = q.data;
  if (q.isLoading || !s) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.warnBox}>
          <Ionicons name="warning" size={16} color="#8A6D1E" />
          <Text style={styles.warnText}>
            Cette opération sera soumise à <Text style={styles.bold}>Président + 1 membre du bureau</Text>. Les 2 validations doivent être réunies (1 refus = rejet immédiat). Délai limite : <Text style={styles.bold}>24h</Text>.
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.target}>
            <Text style={styles.targetLabel}>Cible</Text>
            <Text style={styles.targetName}>{s.member_name ?? 'Membre'}</Text>
            <Text style={styles.targetMeta}>
              Sanction actuelle : {formatXAF(s.amount)} · statut {STATUS_LABEL[s.status] ?? s.status}
            </Text>
          </View>

          <TextField
            label="Nouveau montant (XAF)"
            value={newAmount}
            onChangeText={setNewAmount}
            placeholder="Optionnel"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Nouveau statut</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setNewStatus('')} style={[styles.chip, !newStatus && styles.chipOn]}>
              <Text style={[styles.chipText, !newStatus && styles.chipTextOn]}>Inchangé</Text>
            </Pressable>
            {STATUSES.map((st) => {
              const on = newStatus === st.key;
              return (
                <Pressable key={st.key} onPress={() => setNewStatus(st.key)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{st.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Motif de la demande * (min 5 caractères)"
            value={reason}
            onChangeText={setReason}
            placeholder="Pourquoi cette opération est-elle nécessaire ?"
            multiline
          />

          <PrimaryButton
            title="Soumettre au bureau"
            onPress={onSubmit}
            loading={submit.isPending}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  warnBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md },
  warnText: { flex: 1, fontSize: font.size.xs, color: '#8A6D1E', lineHeight: 18 },
  bold: { fontWeight: font.bold, color: '#7A5B10' },
  card: { borderRadius: radius.lg },
  target: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  targetLabel: { fontSize: font.size.xs, color: colors.textMuted },
  targetName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: 2 },
  targetMeta: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },
});
