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
type Method = 'mobile_money' | 'bank_transfer' | 'cash';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const METHODS: { key: Method; label: string; icon: IoniconName }[] = [
  { key: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { key: 'bank_transfer', label: 'Virement', icon: 'business-outline' },
  { key: 'cash', label: 'Espèces', icon: 'cash-outline' },
];

/** Montant restant dû, plancher à 0. */
function owed(c: Contribution): number {
  return Math.max(0, (Number(c.expected_amount) || 0) - (Number(c.paid_amount) || 0));
}

export default function RegulariserScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  // Deux modals distincts : régularisation d'un impayé (re-soumission avec
  // preuve) vs demande de correction d'un rejet sur séance close (sans preuve,
  // non gérée par le serveur sur ce flux).
  const [selected, setSelected] = useState<Contribution | null>(null);
  const [mode, setMode] = useState<'regularize' | 'correction'>('correction');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<Method>('mobile_money');
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
    mutationFn: (vars: { id: string; newPaidAmount: number; reason: string }) =>
      financeApi.requestContributionCorrection(vars.id, vars.newPaidAmount, vars.reason, null),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['contributions'] });
      Alert.alert('Demande envoyée', 'Votre demande de correction attend la validation du bureau.');
    },
    onError: (e: any) => {
      // Log détaillé pour la console (Metro / adb logcat) — diagnostic backend.
      console.log('[Regulariser] Échec demande de correction:', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
      });
      Alert.alert('Erreur', apiErrorMessage(e));
    },
  });

  // Régularisation d'un impayé : re-soumission de la cotisation en défaut avec
  // justificatif (multipart). Le serveur recycle la ligne DEFAULTED — y compris
  // séance close — la repasse en « soumise » sans mouvement comptable, et la
  // compensation du débit de défaut s'exécute à la validation par le bureau.
  const regularizeMut = useMutation({
    mutationFn: (vars: {
      contribution: Contribution;
      amount: number;
      method: Method;
      proof: { uri: string; name: string; type: string };
    }) => {
      const c = vars.contribution;
      const form = new FormData();
      form.append('session', c.session);
      form.append('membership', c.membership);
      form.append('tontine_type', c.tontine_type);
      form.append('num_shares', String(Number(c.num_shares) || 1));
      form.append('rate_per_share', String(Number(c.rate_per_share) || Number(c.expected_amount) || 0));
      form.append('expected_amount', String(c.expected_amount));
      form.append('paid_amount', String(vars.amount));
      form.append('status', 'submitted');
      form.append('payment_method', vars.method);
      form.append('contribution_justification', vars.proof as any);
      return financeApi.createContribution(form);
    },
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['contributions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      Alert.alert(
        'Régularisation soumise',
        'Votre règlement et sa preuve sont en attente de validation du bureau.',
      );
    },
    onError: (e: any) => {
      console.log('[Regulariser] Échec régularisation:', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
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

  const openModal = (c: Contribution, m: 'regularize' | 'correction') => {
    setSelected(c);
    setMode(m);
    setAmount(m === 'regularize' ? String(owed(c) || '') : String(c.expected_amount ?? ''));
    setReason('');
    setMethod('mobile_money');
    setProofUri(null);
    setFormError(null);
  };

  const closeModal = () => {
    setSelected(null);
    setAmount('');
    setReason('');
    setMethod('mobile_money');
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
    correctionMut.mutate({ id: selected.id, newPaidAmount: n, reason: reason.trim() });
  };

  const submitRegularize = () => {
    if (!selected) return;
    const due = owed(selected);
    const n = Number(amount);
    if (!(n > 0)) {
      setFormError('Saisissez un montant valide.');
      return;
    }
    if (n > due) {
      setFormError(`Le montant ne peut pas dépasser le dû (${formatXAF(due)}).`);
      return;
    }
    if (!proofUri) {
      setFormError('Joignez une preuve de paiement (photo).');
      return;
    }
    setFormError(null);
    const fileName = proofUri.split('/').pop() || `preuve_${Date.now()}.jpg`;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    regularizeMut.mutate({
      contribution: selected,
      amount: n,
      method,
      proof: { uri: proofUri, name: fileName, type: mime },
    });
  };

  const busy = correctionMut.isPending || regularizeMut.isPending;

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
                          Demande en cours
                        </Text>
                      </Pressable>
                      <Text style={styles.note}>Demande de correction déjà en cours.</Text>
                    </>
                  ) : c.status === 'defaulted' ? (
                    <>
                      <Pressable
                        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                        onPress={() => openModal(c, 'regularize')}>
                        <Text style={styles.btnText}>Régulariser (payer + preuve)</Text>
                      </Pressable>
                      <Text style={styles.note}>
                        Votre règlement avec justificatif sera validé par le bureau.
                      </Text>
                    </>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                      onPress={() => openModal(c, 'correction')}>
                      <Text style={styles.btnText}>Demander une correction</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Modal : régularisation d'un impayé (avec preuve) ou demande de correction */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {mode === 'regularize' ? 'Régulariser un impayé' : 'Demander une correction'}
            </Text>

            {selected ? (
              <Text style={styles.modalContext}>
                Séance N°{selected.session_number ?? '—'} · dû {formatXAF(owed(selected))}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>
              {mode === 'regularize' ? 'Montant versé' : 'Montant payé déclaré'}
            </Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setFormError(null);
              }}
              keyboardType="numeric"
              placeholder="Montant"
              placeholderTextColor={colors.placeholder}
            />

            {mode === 'regularize' ? (
              <>
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

                <Text style={styles.modalNote}>
                  Votre règlement + preuve seront inspectés par le bureau ; l'impayé (et sa pénalité
                  éventuelle) est soldé après validation.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Motif</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Expliquez (ex: payé en espèces le ...)"
                  placeholderTextColor={colors.placeholder}
                />
                <Text style={styles.modalNote}>
                  La demande (montant + motif) est validée par le président et un membre du bureau,
                  sous 24 h.
                </Text>
              </>
            )}

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnGhost, pressed && styles.btnPressed]}
                onPress={closeModal}
                disabled={busy}>
                <Text style={styles.modalBtnGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.btn, pressed && styles.btnPressed]}
                onPress={mode === 'regularize' ? submitRegularize : submitCorrection}
                disabled={busy}>
                {busy ? (
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
