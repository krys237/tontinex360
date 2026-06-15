import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble, PrimaryButton, OutlineButton } from '../../components/ui';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import type { MembershipStatus } from '../../lib/types/member';
import type { ApprovalActionType } from '../../lib/types/approval';
import { membersApi } from '../../lib/api/members';
import { approvalsApi } from '../../lib/api/approvals';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauMemberDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauMemberDetail'>;

const MEMBER_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending: { label: 'En attente', tone: 'warning' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  expelled: { label: 'Exclu', tone: 'danger' },
  resigned: { label: 'Démissionnaire', tone: 'muted' },
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauMemberDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<Rt>().params;

  const memberQ = useQuery({
    queryKey: ['bureau', 'member', id],
    queryFn: () => membersApi.get(id),
  });

  const requestApproval = useMutation({
    mutationFn: (vars: { action: ApprovalActionType; reason: string }) =>
      approvalsApi.request(vars.action, id, {}, vars.reason),
    onSuccess: (req) => {
      Alert.alert(
        'Demande envoyée',
        'L’action a été soumise à validation du bureau.',
        [{ text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) }, { text: 'OK' }],
      );
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmAction = (action: ApprovalActionType, label: string) =>
    Alert.alert(label, 'Cette action sera soumise à validation du bureau. Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: () => requestApproval.mutate({ action, reason: `${label} via l'application mobile` }),
      },
    ]);

  if (memberQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  const m = memberQ.data;
  if (!m) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.errorText}>Membre introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.pending;
  const initials = `${m.user?.first_name?.[0] ?? ''}${m.user?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const roles = (m.roles ?? []).filter((r) => r.is_active);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identité */}
        <Card style={styles.headCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>
            {m.user?.first_name} {m.user?.last_name}
          </Text>
          <Text style={styles.phone}>{m.user?.telephone}</Text>
          <View style={{ marginTop: 8 }}>
            <StatusChip label={st.label} tone={st.tone} />
          </View>
        </Card>

        {/* Infos */}
        <Card style={styles.card}>
          <Info label="N° de membre" value={`#${m.member_number}`} />
          <Info label="Adhésion" value={formatDateFr(m.joined_date, false) || '—'} />
          <Info label="Fondateur" value={m.is_founder ? 'Oui' : 'Non'} />
          {m.user?.email ? <Info label="Email" value={m.user.email} /> : null}
        </Card>

        {/* Rôles */}
        <Text style={styles.sectionLabel}>Rôles</Text>
        <Card style={styles.card}>
          {roles.length === 0 ? (
            <Text style={styles.muted}>Aucun rôle actif (membre lambda).</Text>
          ) : (
            roles.map((r, i) => (
              <View key={r.id} style={[styles.roleRow, i > 0 && styles.divider]}>
                <IconBubble icon="ribbon" tint={r.role?.is_bureau_role ? 'primary' : 'lime'} size={32} />
                <Text style={styles.roleName}>{r.role?.name}</Text>
                {r.role?.is_bureau_role ? <StatusChip label="Bureau" tone="info" /> : null}
              </View>
            ))
          )}
        </Card>

        {/* Actions sensibles (→ approbation bureau) */}
        <RequirePermission anyOf={['members.suspend_member', 'members.expel_member', 'members.*']} president>
          <Text style={styles.sectionLabel}>Actions</Text>
          <View style={{ gap: spacing.sm }}>
            {m.status !== 'suspended' ? (
              <OutlineButton
                title="Suspendre le membre"
                onPress={() => confirmAction('member.suspend', 'Suspension du membre')}
                disabled={requestApproval.isPending}
              />
            ) : null}
            {m.status !== 'expelled' ? (
              <PrimaryButton
                title="Exclure le membre"
                onPress={() => confirmAction('member.expel', 'Exclusion du membre')}
                loading={requestApproval.isPending}
              />
            ) : null}
            <Text style={styles.hint}>
              Ces actions nécessitent la validation du président et d’un membre du bureau.
            </Text>
          </View>
        </RequirePermission>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  errorText: { textAlign: 'center', marginTop: spacing.x4, color: colors.textMuted },

  headCard: { alignItems: 'center', gap: 2 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { color: colors.white, fontSize: 26, fontWeight: font.bold },
  name: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  phone: { fontSize: font.size.sm, color: colors.textMuted },

  card: { borderRadius: radius.lg, gap: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: font.size.sm, color: colors.textMuted },
  infoValue: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  roleName: { flex: 1, fontSize: font.size.md, fontWeight: font.medium, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted, paddingVertical: 4 },
  hint: { fontSize: font.size.xs, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
});
