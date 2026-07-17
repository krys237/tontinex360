import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, SectionHeader, IconBubble } from '../../components/ui';
import { sanctionsApi, type SanctionStatus, type Sanction } from '../../lib/api/sanctions';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatXAF } from '../../lib/utils/format';
import { apiErrorMessage } from '../../lib/utils/errors';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Method = 'mobile_money' | 'bank_transfer' | 'cash';

const METHODS: { key: Method; label: string; icon: IoniconName }[] = [
  { key: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { key: 'bank_transfer', label: 'Virement', icon: 'business-outline' },
  { key: 'cash', label: 'Espèces', icon: 'cash-outline' },
];

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dateFR(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const SANCTION_STATUS: Record<SanctionStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'À régler', bg: colors.goldSoft, fg: colors.warning },
  submitted: { label: 'En attente de validation', bg: colors.tintBlueBg, fg: colors.info },
  paid: { label: 'Payée', bg: colors.greenBg, fg: colors.success },
  rejected: { label: 'Rejetée', bg: colors.dangerSoft, fg: colors.danger },
  waived: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted },
  contested: { label: 'Contestée', bg: colors.tintBlueBg, fg: colors.info },
};

export default function MesSanctionsScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const qc = useQueryClient();

  const sanctionsQ = useQuery({
    queryKey: ['sanctions', 'mine', myId ?? null],
    queryFn: () => sanctionsApi.mySanctions(),
  });

  // Modal de paiement
  const [selected, setSelected] = useState<Sanction | null>(null);
  const [method, setMethod] = useState<Method>('mobile_money');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const sanctions = sanctionsQ.data ?? [];
  const toSettle = useMemo(
    () => sanctions.filter((s) => s.status === 'pending' || s.status === 'rejected'),
    [sanctions],
  );
  const totalToPay = useMemo(
    () => toSettle.reduce((acc, s) => acc + (Number(s.amount) || 0), 0),
    [toSettle],
  );

  const payMut = useMutation({
    mutationFn: (vars: {
      id: string;
      method: Method;
      proof: { uri: string; name: string; type: string } | null;
    }) => sanctionsApi.submitPayment(vars.id, vars.method, vars.proof),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['sanctions'] });
      qc.invalidateQueries({ queryKey: ['sanctions', 'mine'] });
      Alert.alert('Paiement soumis', 'En attente de validation du bureau.');
    },
    onError: (e: any) => {
      console.log('[MesSanctions] Échec paiement:', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
      });
      Alert.alert('Erreur', apiErrorMessage(e));
    },
  });

  // Sélecteur photo (même pattern que RegulariserScreen : lazy + guardé).
  const pickFrom = async (source: 'camera' | 'gallery') => {
    let ImagePicker: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImagePicker = require('expo-image-picker');
    } catch {
      return Alert.alert(
        'Reconstruction requise',
        "Le sélecteur de photo nécessite de reconstruire l'app.",
      );
    }
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission requise', 'Autorisez l’accès pour joindre une preuve.');
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setProofUri(res.assets[0].uri);
        setFormError(null);
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur.");
    }
  };

  const openModal = (s: Sanction) => {
    setSelected(s);
    setMethod('mobile_money');
    setProofUri(null);
    setFormError(null);
  };

  const closeModal = () => {
    setSelected(null);
    setMethod('mobile_money');
    setProofUri(null);
    setFormError(null);
  };

  const submitPayment = () => {
    if (!selected) return;
    if (!proofUri) {
      setFormError('Joignez une preuve de paiement (photo).');
      return;
    }
    setFormError(null);
    const fileName = proofUri.split('/').pop() || `preuve_${Date.now()}.jpg`;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    payMut.mutate({
      id: selected.id,
      method,
      proof: { uri: proofUri, name: fileName, type: mime },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={sanctionsQ.isRefetching} onRefresh={() => sanctionsQ.refetch()} tintColor={colors.primary} />
        }>
        {/* Résumé */}
        <Card style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>Total à régler</Text>
            <Text style={styles.summaryValue}>{formatXAF(totalToPay)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{toSettle.length}</Text>
              <Text style={styles.summaryItemLabel}>À régler</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{sanctions.length}</Text>
              <Text style={styles.summaryItemLabel}>Au total</Text>
            </View>
          </View>
        </Card>

        {/* Mes sanctions */}
        <Card style={styles.card}>
          <SectionHeader title="Mes sanctions" />
          {sanctionsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : sanctions.length === 0 ? (
            <View style={styles.emptyBox}>
              <IconBubble icon="shield-checkmark-outline" tint="lime" size={56} />
              <Text style={styles.emptyText}>Aucune sanction. Bravo !</Text>
            </View>
          ) : (
            sanctions.map((s, i) => {
              const st = SANCTION_STATUS[s.status] ?? SANCTION_STATUS.pending;
              const canPay = s.status === 'pending' || s.status === 'rejected';
              const isRejected = s.status === 'rejected';
              return (
                <View key={s.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowHead}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.type_name ?? 'Sanction'}</Text>
                      {s.reason ? <Text style={styles.rowSub} numberOfLines={2}>{s.reason}</Text> : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.rowMetaRow}>
                    <Text style={styles.amount}>{formatXAF(s.amount)}</Text>
                    {s.created_at ? <Text style={styles.rowMeta}>{dateFR(s.created_at)}</Text> : null}
                  </View>

                  {isRejected && s.rejection_reason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>Motif du rejet : {s.rejection_reason}</Text>
                    </View>
                  ) : null}

                  {canPay ? (
                    <Pressable
                      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                      onPress={() => openModal(s)}>
                      <Text style={styles.btnText}>
                        {isRejected ? 'Re-soumettre le paiement' : 'Payer'}
                      </Text>
                    </Pressable>
                  ) : s.status === 'submitted' ? (
                    <Text style={styles.note}>Paiement soumis — en attente de validation du bureau.</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      {/* Modal de paiement */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Régler la sanction</Text>

            {selected ? (
              <Text style={styles.modalContext}>
                {selected.type_name ?? 'Sanction'} · {formatXAF(selected.amount)}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Méthode de paiement</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => {
                const on = m.key === method;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={[styles.methodChip, on && styles.methodChipOn]}>
                    <Ionicons name={m.icon} size={18} color={on ? colors.primary : colors.textMuted} />
                    <Text style={[styles.methodChipText, on && styles.methodChipTextOn]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Preuve de paiement</Text>
            <View style={styles.proofRow}>
              <Pressable style={styles.proofBtn} onPress={() => pickFrom('camera')}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
                <Text style={styles.proofBtnText}>Photo</Text>
              </Pressable>
              <Pressable style={styles.proofBtn} onPress={() => pickFrom('gallery')}>
                <Ionicons name="image-outline" size={20} color={colors.primary} />
                <Text style={styles.proofBtnText}>Galerie</Text>
              </Pressable>
            </View>
            {proofUri ? (
              <Image source={{ uri: proofUri }} style={styles.proofPreview} resizeMode="cover" />
            ) : null}

            <Text style={styles.modalNote}>Votre paiement + preuve seront validés par le bureau.</Text>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnGhost, pressed && styles.btnPressed]}
                onPress={closeModal}
                disabled={payMut.isPending}>
                <Text style={styles.modalBtnGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.btn, pressed && styles.btnPressed]}
                onPress={submitPayment}
                disabled={payMut.isPending}>
                {payMut.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.btnText}>Envoyer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x3 },

  // Résumé
  summary: { borderRadius: radius.lg, gap: spacing.md, ...cardShadow },
  summaryMain: {},
  summaryLabel: { fontSize: font.size.xs, fontWeight: font.semibold, letterSpacing: 0.5, color: colors.textMuted },
  summaryValue: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, letterSpacing: -0.5, marginTop: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'flex-start' },
  summaryItemValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  summaryItemLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, marginHorizontal: 12 },

  card: { borderRadius: radius.lg, ...cardShadow },

  // Sanctions
  row: { paddingVertical: 12, gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  rowMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  amount: { fontSize: font.size.md, fontWeight: font.bold, color: colors.danger },
  rowMeta: { fontSize: font.size.sm, color: colors.textMuted },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  reasonBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12 },
  reasonText: { fontSize: font.size.sm, color: colors.textMuted },

  note: { fontSize: font.size.xs, color: colors.textLight },

  emptyBox: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x2 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },

  btn: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: colors.white, fontSize: font.size.base, fontWeight: font.semibold },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.x2,
    gap: 10,
  },
  modalTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  modalContext: { fontSize: font.size.sm, color: colors.textMuted },
  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginTop: 4 },

  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
  },
  methodChipOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  methodChipText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted },
  methodChipTextOn: { color: colors.primary },

  proofRow: { flexDirection: 'row', gap: 10 },
  proofBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  proofBtnText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  proofPreview: { width: '100%', height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },

  modalNote: { fontSize: font.size.xs, color: colors.textLight },
  errorText: { fontSize: font.size.sm, color: colors.error },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1 },
  modalBtnGhost: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  modalBtnGhostText: { fontSize: font.size.base, fontWeight: font.semibold, color: colors.textMuted },
});
