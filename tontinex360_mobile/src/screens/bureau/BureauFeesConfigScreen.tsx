import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { TextField, PrimaryButton, IconBubble } from '../../components/ui';
import RequirePermission from '../../components/bureau/RequirePermission';
import { memberFeesApi, type MembershipFeesConfig } from '../../lib/api/member-fees';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF } from '../../lib/utils/format';

const DEFAULT_CONFIG: MembershipFeesConfig = {
  registration: { enabled: false, amount: 0, is_entry_gate: false },
  membership_fund: { enabled: false, amount: 0, scope: 'lifetime', allow_partial: false, blocks_access: false },
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

/** Toggle compact "Activé" aligné à droite (largeur fixe au contenu). */
function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable style={styles.toggle} onPress={disabled ? undefined : onToggle} hitSlop={8}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>Activé</Text>
    </Pressable>
  );
}

/** Case à cocher pleine largeur avec libellé + indice (options détaillées). */
function Check({ on, label, hint, onToggle, disabled }: { on: boolean; label: string; hint?: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable style={styles.checkRow} onPress={disabled ? undefined : onToggle}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
      <View style={styles.flex}>
        <Text style={styles.checkLabel}>{label}</Text>
        {hint ? <Text style={styles.checkHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function BureauFeesConfigScreen() {
  const qc = useQueryClient();
  const p = usePermissions();
  const canEdit = p.isPresident || p.canAny(['*', 'members.*']);
  const [form, setForm] = useState<MembershipFeesConfig | null>(null);

  const configQ = useQuery({ queryKey: ['bureau', 'fees', 'config'], queryFn: () => memberFeesApi.getConfig(), retry: false });

  useEffect(() => {
    if (configQ.data && !form) {
      // Fusion avec des valeurs par défaut : tolère un payload partiel du backend.
      setForm({
        registration: { ...DEFAULT_CONFIG.registration, ...(configQ.data.registration ?? {}) },
        membership_fund: { ...DEFAULT_CONFIG.membership_fund, ...(configQ.data.membership_fund ?? {}) },
      });
    }
  }, [configQ.data, form]);

  const saveMut = useMutation({
    mutationFn: () => memberFeesApi.updateConfig(form!),
    onSuccess: (data) => {
      setForm({
        registration: { ...DEFAULT_CONFIG.registration, ...(data.registration ?? {}) },
        membership_fund: { ...DEFAULT_CONFIG.membership_fund, ...(data.membership_fund ?? {}) },
      });
      qc.invalidateQueries({ queryKey: ['bureau', 'fees', 'config'] });
      Alert.alert('Enregistré', 'La configuration des frais a été mise à jour.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (configQ.isLoading || !form) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  const reg = form.registration;
  const fund = form.membership_fund;
  const setReg = (patch: Partial<MembershipFeesConfig['registration']>) => setForm({ ...form, registration: { ...reg, ...patch } });
  const setFund = (patch: Partial<MembershipFeesConfig['membership_fund']>) => setForm({ ...form, membership_fund: { ...fund, ...patch } });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* À propos */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>À propos de ces frais</Text>
          <Text style={styles.infoText}>• <Text style={styles.bold}>Inscription</Text> : montant fixe payé une seule fois à l'adhésion. Si « porte d'entrée », le membre reste en attente tant que non payé.</Text>
          <Text style={styles.infoText}>• <Text style={styles.bold}>Fond de membre</Text> : à payer à vie OU à chaque cycle. Échelonnement possible, non-remboursable.</Text>
          <Text style={styles.infoText}>• Les versements sont enregistrés depuis la fiche du membre.</Text>
        </View>

        {/* Inscription */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <IconBubble icon="cash" tint="accent" size={40} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Inscription</Text>
              <Text style={styles.cardSub}>Frais one-shot à l'adhésion</Text>
            </View>
            <Toggle on={reg.enabled} onToggle={() => setReg({ enabled: !reg.enabled })} disabled={!canEdit} />
          </View>
          {reg.enabled ? (
            <View style={styles.cardBody}>
              <TextField
                label="Montant (XAF)"
                value={String(reg.amount ?? 0)}
                onChangeText={(t) => setReg({ amount: Number(t) || 0 })}
                keyboardType="numeric"
                editable={canEdit}
                helper={`Aperçu : ${formatXAF(reg.amount)}`}
              />
              <Check
                on={reg.is_entry_gate}
                label="Porte d'entrée (bloque l'accès)"
                hint="Le membre reste en attente jusqu'au paiement complet de l'inscription."
                onToggle={() => setReg({ is_entry_gate: !reg.is_entry_gate })}
                disabled={!canEdit}
              />
            </View>
          ) : null}
        </View>

        {/* Fond de membre */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <IconBubble icon="wallet" tint="lime" size={40} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Fond de membre</Text>
              <Text style={styles.cardSub}>Capital de l'association, échelonnable</Text>
            </View>
            <Toggle on={fund.enabled} onToggle={() => setFund({ enabled: !fund.enabled })} disabled={!canEdit} />
          </View>
          {fund.enabled ? (
            <View style={styles.cardBody}>
              <TextField
                label="Montant (XAF)"
                value={String(fund.amount ?? 0)}
                onChangeText={(t) => setFund({ amount: Number(t) || 0 })}
                keyboardType="numeric"
                editable={canEdit}
                helper={`Aperçu : ${formatXAF(fund.amount)}`}
              />
              <Text style={styles.fieldLabel}>Périodicité</Text>
              <View style={styles.scopeRow}>
                <Pressable disabled={!canEdit} onPress={() => setFund({ scope: 'lifetime' })} style={[styles.scopeBtn, fund.scope === 'lifetime' && styles.scopeOn]}>
                  <Text style={[styles.scopeText, fund.scope === 'lifetime' && styles.scopeTextOn]}>🌱 À vie</Text>
                  <Text style={styles.scopeHint}>1 fois par membre</Text>
                </Pressable>
                <Pressable disabled={!canEdit} onPress={() => setFund({ scope: 'per_cycle' })} style={[styles.scopeBtn, fund.scope === 'per_cycle' && styles.scopeOn]}>
                  <Text style={[styles.scopeText, fund.scope === 'per_cycle' && styles.scopeTextOn]}>🔄 Par cycle</Text>
                  <Text style={styles.scopeHint}>À chaque nouveau cycle</Text>
                </Pressable>
              </View>
              <Check on={fund.allow_partial} label="Échelonnement autorisé" hint="Le membre peut payer en plusieurs versements." onToggle={() => setFund({ allow_partial: !fund.allow_partial })} disabled={!canEdit} />
              <Check on={fund.blocks_access} label="Bloquer l'accès si non payé (déconseillé)" hint="Par défaut, le fond non payé n'empêche pas l'utilisation de l'app." onToggle={() => setFund({ blocks_access: !fund.blocks_access })} disabled={!canEdit} />
            </View>
          ) : null}
        </View>

        <RequirePermission bureau>
          <PrimaryButton title="Enregistrer la configuration" onPress={() => saveMut.mutate()} loading={saveMut.isPending} />
        </RequirePermission>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  infoBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  infoTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10', marginBottom: 2 },
  infoText: { fontSize: font.size.xs, color: '#8A6D1E' },
  bold: { fontWeight: font.bold },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...cardShadow },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  cardSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  cardBody: { marginTop: spacing.md, gap: 4 },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  toggleTextOn: { color: colors.primary },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  checkLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  checkHint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  fieldLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8, marginTop: 4 },
  scopeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  scopeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  scopeOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  scopeText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  scopeTextOn: { color: colors.primary },
  scopeHint: { fontSize: 10, color: colors.textLight, marginTop: 2 },
});
