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
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { financeApi } from '../../lib/api/finance';
import type { Contribution } from '../../lib/types/finance';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatXAF } from '../../lib/utils/format';
import { apiErrorMessage } from '../../lib/utils/errors';
import type { AppStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Montant restant dû, plancher à 0. */
function owed(c: Contribution): number {
  return Math.max(0, (Number(c.expected_amount) || 0) - (Number(c.paid_amount) || 0));
}

export default function RegulariserScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const [selected, setSelected] = useState<Contribution | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const contribsQ = useQuery({
    queryKey: ['contributions', 'regularize', myId ?? null],
    queryFn: () => financeApi.contributions(myId ? { membership: myId } : undefined),
  });

  const items = useMemo(
    () => (contribsQ.data ?? []).filter((c) => c.status === 'rejected' || c.status === 'defaulted'),
    [contribsQ.data],
  );

  const totalDue = useMemo(() => items.reduce((acc, c) => acc + owed(c), 0), [items]);

  const correctionMut = useMutation({
    mutationFn: (vars: {
      id: string;
      newPaidAmount: number;
      reason: string;
      proof: { uri: string; name: string; type: string } | null;
    }) =>
      financeApi.requestContributionCorrection(vars.id, vars.newPaidAmount, vars.reason, vars.proof),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['contributions'] });
      Alert.alert('Demande envoyée', 'Votre demande et sa preuve sont en attente de validation du bureau.');
    },
    onError: (e: any) => {
      // Log détaillé pour la console (Metro / adb logcat) — diagnostic backend.
      console.log('[Regulariser] Échec demande de correction:', {
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
        message: e?.message,
        url: e?.config?.url,
        method: e?.config?.method,
      });
      Alert.alert('Erreur', apiErrorMessage(e));
    },
  });

  // Sélecteur photo (même pattern que CotiserScreen : lazy + guardé).
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
      if (!res.canceled && res.assets?.[0]?.uri) setProofUri(res.assets[0].uri);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur.");
    }
  };

  const openModal = (c: Contribution) => {
    setSelected(c);
    setAmount(String(c.expected_amount ?? ''));
    setReason('');
    setProofUri(null);
    setFormError(null);
  };

  const closeModal = () => {
    setSelected(null);
    setAmount('');
    setReason('');
    setProofUri(null);
    setFormError(null);
  };

  const submitCorrection = () => {
    if (!selected) return;
    const n = Number(amount);
    if (!amount.trim() || Number.isNaN(n) || n < 0) {
      setFormError('Saisissez un montant valide (≥ 0).');
      return;
    }
    if (n === Number(selected.paid_amount)) {
      setFormError("Le montant doit différer du montant déjà comptabilisé.");
      return;
    }
    if (reason.trim().length < 5) {
      setFormError('Expliquez brièvement votre demande (au moins 5 caractères).');
      return;
    }
    setFormError(null);
    // Interim : on envoie en JSON (sans le fichier) — le backend ne gère pas
    // encore l'upload sur request-correction (500). La preuve sera réactivée
    // (multipart) dès que le champ `submitted_justification` sera ajouté côté serveur.
    correctionMut.mutate({
      id: selected.id,
      newPaidAmount: n,
      reason: reason.trim(),
      proof: null,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={contribsQ.isRefetching}
            onRefresh={() => contribsQ.refetch()}
            tintColor={colors.primary}
          />
        }>
        {contribsQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Aucune cotisation à régulariser. Vous êtes à jour !</Text>
          </View>
        ) : (
          <>
            {/* Résumé */}
            <Card style={styles.summary}>
              <View style={styles.summaryMain}>
                <Text style={styles.summaryLabel}>Total dû</Text>
                <Text style={styles.summaryValue}>{formatXAF(totalDue)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemValue}>{items.length}</Text>
                  <Text style={styles.summaryItemLabel}>À régulariser</Text>
                </View>
              </View>
            </Card>

            {items.map((c) => {
              const isRejected = c.status === 'rejected';
              const badge = isRejected
                ? { label: 'Rejetée', bg: colors.dangerSoft, fg: colors.danger }
                : { label: 'Impayée', bg: colors.goldSoft, fg: colors.warning };
              const sessionOpen =
                c.session_status === 'scheduled' || c.session_status === 'in_progress';
              const canRecotise = isRejected && sessionOpen;

              return (
                <Card key={c.id} style={styles.card}>
                  <View style={styles.rowHead}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>Séance N°{c.session_number ?? '—'}</Text>
                      {c.tontine_type_name ? (
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {c.tontine_type_name}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.due}>Montant dû : {formatXAF(owed(c))}</Text>

                  {isRejected && c.rejection_reason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>Motif du rejet : {c.rejection_reason}</Text>
                    </View>
                  ) : null}

                  {canRecotise ? (
                    <>
                      <Pressable
                        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                        onPress={() => navigation.navigate('MesTontines')}>
                        <Text style={styles.btnText}>Re-cotiser cette séance</Text>
                      </Pressable>
                      <Text style={styles.note}>
                        La séance est encore ouverte — re-soumettez votre cotisation.
                      </Text>
                    </>
                  ) : c.has_pending_correction ? (
                    <>
                      <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
                        <Text style={[styles.btnText, styles.btnTextDisabled]}>
                          Demander une correction
                        </Text>
                      </Pressable>
                      <Text style={styles.note}>Demande de correction déjà en cours.</Text>
                    </>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                      onPress={() => openModal(c)}>
                      <Text style={styles.btnText}>Demander une correction</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Modal de correction */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Demander une correction</Text>

            {selected ? (
              <Text style={styles.modalContext}>
                Séance N°{selected.session_number ?? '—'} · dû {formatXAF(owed(selected))}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Montant payé déclaré</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Montant"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={reason}
              onChangeText={setReason}
              multiline
              placeholder="Expliquez (ex: payé en espèces le ...)"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.fieldLabel}>Preuve (bientôt)</Text>
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

            <Text style={styles.modalNote}>
              La demande (montant + motif) est validée par le président et un membre du bureau.
              L'envoi de la preuve photo sera activé prochainement.
            </Text>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnGhost, pressed && styles.btnPressed]}
                onPress={closeModal}
                disabled={correctionMut.isPending}>
                <Text style={styles.modalBtnGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.btn, pressed && styles.btnPressed]}
                onPress={submitCorrection}
                disabled={correctionMut.isPending}>
                {correctionMut.isPending ? (
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
  loader: { marginTop: spacing.x3 },

  emptyBox: { alignItems: 'center', paddingVertical: spacing.x4, paddingHorizontal: spacing.lg },
  emptyText: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center' },

  // Résumé
  summary: { borderRadius: radius.lg, gap: spacing.md, ...cardShadow },
  summaryMain: {},
  summaryLabel: {
    fontSize: font.size.xs,
    fontWeight: font.semibold,
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: font.size.x2,
    fontWeight: font.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'flex-start' },
  summaryItemValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  summaryItemLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  // Carte cotisation
  card: { borderRadius: radius.lg, gap: 10, ...cardShadow },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  due: { fontSize: font.size.md, fontWeight: font.bold, color: colors.danger },

  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  reasonBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 12,
  },
  reasonText: { fontSize: font.size.sm, color: colors.textMuted },

  note: { fontSize: font.size.xs, color: colors.textLight, textAlign: 'center' },

  btn: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPressed: { opacity: 0.9 },
  btnDisabled: { backgroundColor: colors.surfaceMuted },
  btnText: { color: colors.white, fontSize: font.size.base, fontWeight: font.semibold },
  btnTextDisabled: { color: colors.textLight },

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
  fieldLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.text,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: font.size.md,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  proofRow: { flexDirection: 'row', gap: 10 },
  proofBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
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
