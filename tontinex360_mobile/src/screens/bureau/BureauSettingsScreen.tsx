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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import RequirePermission from '../../components/bureau/RequirePermission';
import { Card, TextField, PrimaryButton, IconBubble } from '../../components/ui';
import { membersApi } from '../../lib/api/members';
import { approvalsApi } from '../../lib/api/approvals';
import { financeApi } from '../../lib/api/finance';
import type { ApprovalDecisionRule } from '../../lib/types/approval';
import type { BureauStackParamList } from '../../navigation/types';
import { actionLabel } from '../../lib/bureau/approval-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type TabKey = 'roles' | 'positions' | 'policies' | 'loans';

const RULES: { key: ApprovalDecisionRule; label: string }[] = [
  { key: 'unanimous', label: 'Unanimité' },
  { key: 'majority', label: 'Majorité' },
  { key: 'president_overrides', label: 'Président' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

type Rt = RouteProp<BureauStackParamList, 'BureauSettings'>;

export default function BureauSettingsScreen() {
  const qc = useQueryClient();
  const initialTab = useRoute<Rt>().params?.tab;
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'roles');
  const [roleName, setRoleName] = useState('');
  const [posName, setPosName] = useState('');

  const rolesQ = useQuery({ queryKey: ['bureau', 'roles'], queryFn: () => membersApi.roles(), enabled: tab === 'roles' });
  const posQ = useQuery({ queryKey: ['bureau', 'positions'], queryFn: () => membersApi.bureauPositions(), enabled: tab === 'positions' });
  const policiesQ = useQuery({ queryKey: ['bureau', 'policies'], queryFn: () => approvalsApi.listPolicies(), enabled: tab === 'policies', retry: false });
  const loanQ = useQuery({ queryKey: ['bureau', 'loan-settings'], queryFn: () => financeApi.getLoanSettings(), enabled: tab === 'loans', retry: false });

  const onErr = (e: any) => Alert.alert('Erreur', errMsg(e));

  const createRole = useMutation({
    mutationFn: () => membersApi.createRole({ name: roleName.trim() }),
    onSuccess: () => { setRoleName(''); qc.invalidateQueries({ queryKey: ['bureau', 'roles'] }); },
    onError: onErr,
  });
  const removeRole = useMutation({
    mutationFn: (id: string) => membersApi.removeRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'roles'] }),
    onError: onErr,
  });
  const createPos = useMutation({
    mutationFn: () => membersApi.createBureauPosition({ name: posName.trim() }),
    onSuccess: () => { setPosName(''); qc.invalidateQueries({ queryKey: ['bureau', 'positions'] }); },
    onError: onErr,
  });
  const removePos = useMutation({
    mutationFn: (id: string) => membersApi.removeBureauPosition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'positions'] }),
    onError: onErr,
  });
  const updatePolicy = useMutation({
    mutationFn: (vars: { actionType: string; rule: ApprovalDecisionRule; approvers: any[]; threshold: number | null }) =>
      approvalsApi.updatePolicy(vars.actionType, {
        approvers: vars.approvers,
        decision_rule: vars.rule,
        majority_threshold: vars.threshold,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'policies'] }),
    onError: onErr,
  });

  const tabs = [
    { key: 'roles', label: 'Rôles' },
    { key: 'positions', label: 'Postes' },
    { key: 'policies', label: 'Approbations' },
    { key: 'loans', label: 'Prêts' },
  ];
  const activeQ = tab === 'roles' ? rolesQ : tab === 'positions' ? posQ : tab === 'policies' ? policiesQ : loanQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={activeQ.isRefetching} onRefresh={() => activeQ.refetch()} tintColor={colors.primary} />}
      >
        {/* ---- Rôles ---- */}
        {tab === 'roles' ? (
          <>
            <RequirePermission president fallback={<Empty icon="lock-closed-outline" text="Réservé au président." />}>
              <Card style={styles.formCard}>
                <Text style={styles.formTitle}>Nouveau rôle</Text>
                <TextField label="Nom du rôle" value={roleName} onChangeText={setRoleName} placeholder="Ex : Cotiseur senior" />
                <PrimaryButton title="Créer" onPress={() => createRole.mutate()} loading={createRole.isPending} disabled={!roleName.trim()} />
              </Card>
              {rolesQ.isLoading ? <Loader /> : (rolesQ.data ?? []).map((r) => (
                <View key={r.id} style={styles.row}>
                  <IconBubble icon="ribbon" tint={r.is_bureau_role ? 'primary' : 'lime'} size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{r.name}</Text>
                    <Text style={styles.rowSub}>{r.permissions?.length ?? 0} permission(s)</Text>
                  </View>
                  {r.is_bureau_role ? <StatusChip label="Bureau" tone="info" /> : null}
                  {!r.is_system ? (
                    <ActionBtn icon="trash" tone="danger" loading={removeRole.isPending && removeRole.variables === r.id} onPress={() => removeRole.mutate(r.id)} />
                  ) : null}
                </View>
              ))}
            </RequirePermission>
          </>
        ) : null}

        {/* ---- Postes ---- */}
        {tab === 'positions' ? (
          <>
            <RequirePermission bureau>
              <Card style={styles.formCard}>
                <Text style={styles.formTitle}>Nouveau poste de bureau</Text>
                <TextField label="Nom du poste" value={posName} onChangeText={setPosName} placeholder="Ex : Commissaire adjoint" />
                <PrimaryButton title="Créer" onPress={() => createPos.mutate()} loading={createPos.isPending} disabled={!posName.trim()} />
              </Card>
            </RequirePermission>
            {posQ.isLoading ? <Loader /> : (posQ.data ?? []).map((p) => (
              <View key={p.id} style={styles.row}>
                <IconBubble icon="briefcase" tint="accent" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  {p.is_required ? <Text style={styles.rowSub}>Obligatoire</Text> : null}
                </View>
                <RequirePermission bureau>
                  <ActionBtn icon="trash" tone="danger" loading={removePos.isPending && removePos.variables === p.id} onPress={() => removePos.mutate(p.id)} />
                </RequirePermission>
              </View>
            ))}
          </>
        ) : null}

        {/* ---- Policies d'approbation ---- */}
        {tab === 'policies' ? (
          policiesQ.isLoading ? <Loader /> : !policiesQ.data ? <Empty icon="lock-closed-outline" text="Réservé au président." /> : (
            <>
              {!policiesQ.data.can_modify ? (
                <Text style={styles.hint}>Lecture seule — seul le président peut modifier les règles.</Text>
              ) : null}
              {policiesQ.data.items.map((it) => (
                <Card key={it.action_type} style={styles.policyCard}>
                  <Text style={styles.policyTitle}>{it.label || actionLabel(it.action_type)}</Text>
                  <Text style={styles.rowSub}>{it.policy.approvers.length} validateur(s)</Text>
                  <View style={styles.ruleRow}>
                    {RULES.map((rule) => {
                      const on = it.policy.decision_rule === rule.key;
                      return (
                        <Pressable
                          key={rule.key}
                          disabled={!policiesQ.data!.can_modify}
                          onPress={() =>
                            updatePolicy.mutate({
                              actionType: it.action_type,
                              rule: rule.key,
                              approvers: it.policy.approvers,
                              threshold: it.policy.majority_threshold,
                            })
                          }
                          style={[styles.ruleChip, on && styles.ruleChipOn]}
                        >
                          <Text style={[styles.ruleText, on && styles.ruleTextOn]}>{rule.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              ))}
            </>
          )
        ) : null}

        {/* ---- Paramètres des prêts ---- */}
        {tab === 'loans' ? (
          loanQ.isLoading ? <Loader /> : !loanQ.data ? <Empty icon="lock-closed-outline" text="Indisponible." /> : (
            <LoanSettingsForm data={loanQ.data} onSaved={() => qc.invalidateQueries({ queryKey: ['bureau', 'loan-settings'] })} />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoanSettingsForm({ data, onSaved }: { data: any; onSaved: () => void }) {
  const [rate, setRate] = useState(String(data.default_interest_rate ?? ''));
  const [duration, setDuration] = useState(String(data.max_duration_days ?? ''));
  const [buffer, setBuffer] = useState(String(data.treasury_buffer_pct ?? ''));

  const saveMut = useMutation({
    mutationFn: () =>
      financeApi.updateLoanSettings({
        default_interest_rate: Number(rate),
        max_duration_days: Number(duration),
        treasury_buffer_pct: Number(buffer),
      }),
    onSuccess: () => {
      onSaved();
      Alert.alert('Enregistré', 'Les paramètres des prêts ont été mis à jour.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canModify = data.can_modify !== false;

  return (
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Paramètres des prêts</Text>
      <TextField label="Taux d'intérêt par défaut (%)" value={rate} onChangeText={setRate} keyboardType="numeric" editable={canModify} />
      <TextField label="Durée maximale (jours)" value={duration} onChangeText={setDuration} keyboardType="numeric" editable={canModify} />
      <TextField label="Réserve de trésorerie (%)" value={buffer} onChangeText={setBuffer} keyboardType="numeric" editable={canModify} />
      {canModify ? (
        <PrimaryButton title="Enregistrer" onPress={() => saveMut.mutate()} loading={saveMut.isPending} />
      ) : (
        <Text style={styles.hint}>Lecture seule — seul le président peut modifier ces paramètres.</Text>
      )}
    </Card>
  );
}

function Loader() {
  return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />;
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
  formCard: { borderRadius: radius.lg, gap: 2, marginBottom: spacing.sm },
  formTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
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
  policyCard: { borderRadius: radius.lg, gap: 4 },
  policyTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  ruleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 6 },
  ruleChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  ruleChipOn: { backgroundColor: colors.primary },
  ruleText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted },
  ruleTextOn: { color: colors.white },
  hint: { fontSize: font.size.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
