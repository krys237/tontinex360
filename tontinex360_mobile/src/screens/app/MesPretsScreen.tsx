import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, SectionHeader } from '../../components/ui';
import LoanRequestModal from '../../components/finance/LoanRequestModal';
import { financeApi } from '../../lib/api/finance';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { LoanStatus, Loan } from '../../lib/types/finance';
import { formatNumber, formatXAF } from '../../lib/utils/format';
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

const LOAN_STATUS: Record<LoanStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: colors.goldAccent },
  approved: { label: 'Approuvé', bg: colors.greenBg, fg: colors.primary },
  disbursed: { label: 'Décaissé', bg: colors.tintBlueBg, fg: colors.info },
  repaying: { label: 'En remboursement', bg: colors.tintBlueBg, fg: colors.info },
  repaid: { label: 'Remboursé', bg: colors.greenBg, fg: colors.success },
  defaulted: { label: 'En défaut', bg: colors.dangerSoft, fg: colors.danger },
};

function remainingOf(l: Loan): number {
  return Number(l.remaining ?? (Number(l.total_due) - Number(l.total_repaid))) || 0;
}

export default function MesPretsScreen() {
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const [loanOpen, setLoanOpen] = useState(false);

  const loansQ = useQuery({
    queryKey: ['loans', 'mine', myId ?? null],
    queryFn: () => financeApi.myLoans(),
  });

  // Modal de remboursement
  const [selected, setSelected] = useState<Loan | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('mobile_money');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loans = loansQ.data ?? [];
  const totalBorrowed = loans.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  const totalRemaining = loans.reduce((acc, l) => acc + remainingOf(l), 0);

  const repayMut = useMutation({
    mutationFn: (vars: {
      id: string;
      amount: number;
      method: Method;
      proof: { uri: string; name: string; type: string } | null;
    }) => financeApi.repayLoan(vars.id, vars.amount, vars.method, vars.proof),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['loans', 'mine'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'me'] });
      Alert.alert('Remboursement soumis', 'En attente de validation du bureau.');
    },
    onError: (e: any) => {
      console.log('[MesPrets] Échec remboursement:', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
      });
      Alert.alert('Erreur', apiErrorMessage(e));
    },
  });

  // Sélecteur photo (même pattern que MesSanctionsScreen : lazy + guardé).
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

  const openModal = (l: Loan) => {
    setSelected(l);
    setAmount(String(remainingOf(l)));
    setMethod('mobile_money');
    setProofUri(null);
    setFormError(null);
  };

  const closeModal = () => {
    setSelected(null);
    setAmount('');
    setMethod('mobile_money');
    setProofUri(null);
    setFormError(null);
  };

  const submitRepayment = () => {
    if (!selected) return;
    const remaining = remainingOf(selected);
    const value = Number(amount);
    if (!(value > 0)) {
      setFormError('Saisissez un montant valide.');
      return;
    }
    if (value > remaining) {
      setFormError(`Le montant ne peut pas dépasser le restant (${formatXAF(remaining)}).`);
      return;
    }
    if (!proofUri) {
      setFormError('Joignez une preuve de remboursement (photo).');
      return;
    }
    setFormError(null);
    const fileName = proofUri.split('/').pop() || `preuve_${Date.now()}.jpg`;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    repayMut.mutate({
      id: selected.id,
      amount: value,
      method,
      proof: { uri: proofUri, name: fileName, type: mime },
    });
  };

  const selectedRemaining = selected ? remainingOf(selected) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loansQ.isRefetching} onRefresh={() => loansQ.refetch()} tintColor={colors.primary} />
        }>
        {/* Résumé */}
        <Card style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>Total emprunté</Text>
            <Text style={styles.summaryValue}>{formatXAF(totalBorrowed)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{loans.length}</Text>
              <Text style={styles.summaryItemLabel}>Prêt{loans.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{formatNumber(totalRemaining)}</Text>
              <Text style={styles.summaryItemLabel}>Restant (FCFA)</Text>
            </View>
          </View>
        </Card>

        {/* Demander un prêt */}
        <Pressable
          onPress={() => setLoanOpen(true)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="cash-outline" size={20} color={colors.white} />
          <Text style={styles.ctaText}>Demander un prêt</Text>
        </Pressable>

        {/* Mes prêts */}
        <Card style={styles.card}>
          <SectionHeader title="Mes prêts" />
          {loansQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : loans.length === 0 ? (
            <Text style={styles.empty}>Aucun prêt pour le moment.</Text>
          ) : (
            loans.map((l, i) => {
              const st = LOAN_STATUS[l.status as keyof typeof LOAN_STATUS] ?? LOAN_STATUS.pending;
              const remaining = remainingOf(l);
              const canRepay = (l.status === 'disbursed' || l.status === 'partial') && remaining > 0;
              return (
                <View key={l.id} style={[styles.loanRow, i > 0 && styles.loanDivider]}>
                  <View style={styles.loanHead}>
                    <View style={styles.flex}>
                      <Text style={styles.loanAmount}>{formatXAF(l.amount)}</Text>
                      <Text style={styles.loanSub} numberOfLines={1}>
                        {l.purpose?.trim() ? l.purpose : `Intérêt ${formatNumber(l.interest_rate)} %`}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.loanMetaRow}>
                    <Text style={styles.loanMeta}>
                      Restant : <Text style={styles.loanMetaStrong}>{formatXAF(remaining)}</Text>
                    </Text>
                    {l.due_date ? <Text style={styles.loanMeta}>Échéance : {dateFR(l.due_date)}</Text> : null}
                  </View>

                  {canRepay ? (
                    <Pressable
                      style={({ pressed }) => [styles.repayBtn, pressed && styles.btnPressed]}
                      onPress={() => openModal(l)}>
                      <Ionicons name="arrow-up-circle-outline" size={18} color={colors.primary} />
                      <Text style={styles.repayBtnText}>Rembourser</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      <LoanRequestModal
        visible={loanOpen}
        onClose={() => setLoanOpen(false)}
        membershipId={myId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['loans'] });
          qc.invalidateQueries({ queryKey: ['wallet', 'me'] });
        }}
      />

      {/* Modal de remboursement */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rembourser le prêt</Text>

            {selected ? (
              <Text style={styles.modalContext}>
                {formatXAF(selected.amount)} · Restant : {formatXAF(selectedRemaining)}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Montant à rembourser</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setFormError(null);
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textLight}
            />

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

            <Text style={styles.fieldLabel}>Preuve de remboursement</Text>
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
              Votre remboursement + preuve seront validés par le bureau ; les intérêts sont
              redistribués après validation.
            </Text>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnGhost, pressed && styles.btnPressed]}
                onPress={closeModal}
                disabled={repayMut.isPending}>
                <Text style={styles.modalBtnGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.btn, pressed && styles.btnPressed]}
                onPress={submitRepayment}
                disabled={repayMut.isPending}>
                {repayMut.isPending ? (
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
  pressed: { opacity: 0.85 },

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

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green[600],
    borderRadius: radius.pill,
    minHeight: 52,
  },
  ctaText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },

  card: { borderRadius: radius.lg, ...cardShadow },

  // Loans
  loanRow: { paddingVertical: 12, gap: 10 },
  loanDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  loanHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  loanAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  loanSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  loanMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  loanMeta: { fontSize: font.size.sm, color: colors.textMuted },
  loanMetaStrong: { color: colors.primary, fontWeight: font.semibold },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  repayBtn: {
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
  repayBtnText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },

  empty: { fontSize: font.size.sm, color: colors.textMuted },

  // Boutons génériques
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

  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: font.size.base,
    color: colors.text,
  },

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
