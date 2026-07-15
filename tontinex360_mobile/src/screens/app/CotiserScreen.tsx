import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { financeApi } from '../../lib/api/finance';
import { cyclesApi } from '../../lib/api/cycles';
import type { Session } from '../../lib/types/cycle';
import { formatXAF } from '../../lib/utils/format';
import type { AppStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Method = 'mobile_money' | 'bank_transfer' | 'cash';

const METHODS: { key: Method; label: string; sub: string; icon: IoniconName }[] = [
  { key: 'mobile_money', label: 'Mobile Money', sub: 'Orange Money, MTN MoMo…', icon: 'phone-portrait-outline' },
  { key: 'bank_transfer', label: 'Virement bancaire', sub: 'Effectuer un virement', icon: 'business-outline' },
  { key: 'cash', label: 'Espèces', sub: 'Paiement en espèces', icon: 'cash-outline' },
];

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
function fullDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STEPS = ['Détails', 'Preuve', 'Confirmation'];

export default function CotiserScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AppStackParamList, 'Cotiser'>>();
  const { membershipId, tontineTypeId, tontineName, cycleId, numShares, ratePerShare, amountPerSession } =
    route.params;
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('mobile_money');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Contributions are NOT pre-created server-side: "cotiser" CREATES one for a session.
  const sessionsQ = useQuery({ queryKey: ['sessions', cycleId], queryFn: () => cyclesApi.sessions({ cycle: cycleId }) });
  const existingQ = useQuery({
    queryKey: ['contributions', 'mine', tontineTypeId],
    queryFn: () => financeApi.contributions({ membership: membershipId, tontine_type: tontineTypeId }),
  });

  // Une séance est bloquée UNIQUEMENT si sa cotisation n'est pas rejetée.
  // Une cotisation rejetée par le trésorier peut être re-soumise pour la MÊME
  // séance → on ne la compte pas comme "déjà cotisée".
  const blockedSessionIds = useMemo(
    () =>
      new Set(
        (existingQ.data ?? [])
          .filter((c) => c.status !== 'rejected')
          .map((c) => c.session),
      ),
    [existingQ.data],
  );

  // Séance → id de la cotisation rejetée (pour re-soumettre via PATCH plutôt que
  // recréer : la contrainte d'unicité backend interdit une 2e cotisation).
  const rejectedBySession = useMemo(() => {
    const m = new Map<string, string>();
    (existingQ.data ?? []).forEach((c) => {
      if (c.status === 'rejected') m.set(c.session, c.id);
    });
    return m;
  }, [existingQ.data]);

  // Sessions the member can still pay for (no active contribution yet), earliest first.
  const payableSessions = useMemo(
    () =>
      (sessionsQ.data ?? [])
        .filter((s) => s.status !== 'cancelled' && !blockedSessionIds.has(s.id))
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [sessionsQ.data, blockedSessionIds],
  );

  const selectedSession =
    payableSessions.find((s) => s.id === selectedSessionId) ?? payableSessions[0];

  const labelForSession = (s: Session) =>
    `Séance ${s.session_number}${s.date ? ` · ${fullDate(s.date)}` : ''}`;

  const amountDue = Number(amountPerSession) || Number(numShares) * Number(ratePerShare) || 0;
  const loading = sessionsQ.isLoading || existingQ.isLoading;
  const noSessions = (sessionsQ.data ?? []).length === 0;

  const pickFrom = async (source: 'camera' | 'gallery') => {
    // Lazy + guarded: avoids crashing the screen if the native module isn't in the
    // current build (e.g. dev-client built before expo-image-picker was added).
    let ImagePicker: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImagePicker = require('expo-image-picker');
    } catch {
      return Alert.alert(
        'Reconstruction requise',
        "Le sélecteur de photo nécessite de reconstruire l'app (npx expo prebuild --clean puis run:android).",
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

  const submit = async () => {
    if (!selectedSession) return;
    if (!proofUri) {
      return Alert.alert(
        'Preuve requise',
        'Joignez une photo ou une capture de votre reçu de paiement avant d’envoyer.',
      );
    }
    setSubmitting(true);
    try {
      // Self-service : on soumet la cotisation AVEC le justificatif photo. Le
      // backend force status='submitted' + is_validated=False (une cotisation pour
      // soi-même doit être validée par le trésorier) → aucun mouvement comptable
      // tant qu'elle n'est pas inspectée. On envoie donc un multipart/form-data.
      const form = new FormData();
      form.append('session', selectedSession.id);
      form.append('membership', membershipId);
      form.append('tontine_type', tontineTypeId);
      form.append('num_shares', String(numShares));
      form.append('rate_per_share', String(ratePerShare));
      form.append('expected_amount', String(amountDue));
      form.append('paid_amount', String(amountDue));
      form.append('status', 'submitted');
      form.append('payment_method', method);

      const fileName = proofUri.split('/').pop() || `preuve_${Date.now()}.jpg`;
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      form.append('contribution_justification', { uri: proofUri, name: fileName, type: mime } as any);

      // Si une cotisation a été REJETÉE pour cette séance, la re-soumission passe
      // par un PATCH (la contrainte d'unicité session+membre+type interdit une
      // 2e création). Sinon, création classique.
      const rejectedId = rejectedBySession.get(selectedSession.id);
      if (rejectedId) {
        await financeApi.updateContribution(rejectedId, form);
      } else {
        await financeApi.createContribution(form);
      }
      qc.invalidateQueries({ queryKey: ['contributions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setStep(2);
    } catch (e: any) {
      const data = e?.response?.data;
      Alert.alert('Erreur', typeof data === 'object' ? Object.values(data).flat().join(' ') : "Enregistrement échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Effectuer une cotisation</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Stepper */}
      {step < 2 || true ? (
        <View style={styles.stepper}>
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, (done || active) && styles.stepCircleOn]}>
                    {done ? (
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    ) : (
                      <Text style={[styles.stepNum, active && styles.stepNumOn]}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>{label}</Text>
                </View>
                {i < STEPS.length - 1 ? <View style={[styles.stepLine, i < step && styles.stepLineOn]} /> : null}
              </React.Fragment>
            );
          })}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* STEP 1 — Détails */}
        {step === 0 &&
          (loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : noSessions ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={40} color={colors.textLight} />
              <Text style={styles.emptyTitle}>Aucune séance planifiée</Text>
              <Text style={styles.emptyText}>
                Le bureau n'a pas encore programmé de séance pour ce cycle. Revenez pour cotiser
                dès qu'une séance sera planifiée.
              </Text>
            </View>
          ) : !selectedSession ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} />
              <Text style={styles.emptyTitle}>Vous êtes à jour</Text>
              <Text style={styles.emptyText}>Toutes les séances de « {tontineName} » sont déjà cotisées.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Séance à cotiser</Text>
              <View style={styles.infoCard}>
                <View style={styles.flex}>
                  <Text style={styles.infoLabel}>Séance sélectionnée</Text>
                  <Text style={styles.infoValue}>{labelForSession(selectedSession)}</Text>
                </View>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </View>

              {payableSessions.length > 1 ? (
                <View style={styles.pickList}>
                  {payableSessions.map((s) => {
                    const on = s.id === selectedSession.id;
                    return (
                      <Pressable key={s.id} onPress={() => setSelectedSessionId(s.id)} style={[styles.pickRow, on && styles.pickRowOn]}>
                        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.primary : colors.textLight} />
                        <Text style={styles.pickLabel}>{labelForSession(s)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Montant à payer</Text>
              <View style={styles.amountCard}>
                <Ionicons name="wallet" size={22} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.amountValue}>{formatXAF(amountDue)}</Text>
                  <Text style={styles.amountHint}>{numShares} part(s) · « {tontineName} »</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Méthode de paiement</Text>
              {METHODS.map((m) => {
                const on = m.key === method;
                return (
                  <Pressable key={m.key} onPress={() => setMethod(m.key)} style={[styles.methodRow, on && styles.methodRowOn]}>
                    <Ionicons name={m.icon} size={22} color={on ? colors.primary : colors.textMuted} />
                    <View style={styles.flex}>
                      <Text style={[styles.methodLabel, on && styles.methodLabelOn]}>{m.label}</Text>
                      <Text style={styles.methodSub}>{m.sub}</Text>
                    </View>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? colors.success : colors.textLight} />
                  </Pressable>
                );
              })}
            </>
          ))}

        {/* STEP 2 — Preuve */}
        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>Téléversez votre preuve de paiement</Text>
            <Text style={styles.helper}>Importez la photo ou capture d'écran de votre reçu de paiement.</Text>
            <View style={styles.optionsRow}>
              <Pressable style={[styles.option, proofUri && styles.optionDone]} onPress={() => pickFrom('camera')}>
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.optionText}>Prendre une photo</Text>
              </Pressable>
              <Pressable style={styles.option} onPress={() => pickFrom('gallery')}>
                <Ionicons name="image-outline" size={24} color={colors.primary} />
                <Text style={styles.optionText}>Galerie</Text>
              </Pressable>
              <Pressable style={styles.option} onPress={() => Alert.alert('Fichier', 'Le choix de fichier (PDF) arrive bientôt.')}>
                <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
                <Text style={styles.optionText}>Fichier</Text>
              </Pressable>
            </View>

            <View style={styles.preview}>
              {proofUri ? (
                <Image source={{ uri: proofUri }} style={styles.previewImg} resizeMode="cover" />
              ) : (
                <Ionicons name="image-outline" size={40} color={colors.textLight} />
              )}
            </View>
            <Text style={styles.proofNote}>
              Votre preuve sera envoyée au trésorier, qui la vérifiera avant de valider la cotisation.
            </Text>
          </>
        )}

        {/* STEP 3 — Confirmation */}
        {step === 2 && (
          <View style={styles.confirm}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={48} color={colors.white} />
            </View>
            <Text style={styles.confirmTitle}>Cotisation soumise</Text>
            <Text style={styles.confirmSub}>
              Votre preuve a été envoyée au trésorier. Vous serez notifié dès sa validation.
            </Text>

            <View style={styles.recap}>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Séance</Text>
                <Text style={styles.recapValue}>{selectedSession ? labelForSession(selectedSession) : '—'}</Text>
              </View>
              <View style={[styles.recapRow, styles.recapDivider]}>
                <Text style={styles.recapLabel}>Montant</Text>
                <Text style={styles.recapValue}>{formatXAF(amountDue)}</Text>
              </View>
              <View style={[styles.recapRow, styles.recapDivider]}>
                <Text style={styles.recapLabel}>Statut</Text>
                <Text style={styles.recapStatusPending}>En attente de validation</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.bottom}>
        {step === 0 && (
          <PrimaryCta label="Cotiser maintenant" disabled={!selectedSession} onPress={() => setStep(1)} />
        )}
        {step === 1 && (
          <PrimaryCta label="Envoyer la preuve" loading={submitting} onPress={submit} />
        )}
        {step === 2 && <PrimaryCta label="Terminer" onPress={() => navigation.goBack()} />}
      </View>
    </SafeAreaView>
  );
}

function PrimaryCta({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} style={({ pressed }) => [{ borderRadius: radius.lg }, pressed && { opacity: 0.9 }]}>
      <LinearGradient
        colors={off ? [colors.textLight, colors.textLight] : [colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cta}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.ctaText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },

  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.x2, paddingVertical: spacing.lg },
  stepItem: { alignItems: 'center', width: 64 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepCircleOn: { backgroundColor: colors.primary },
  stepNum: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.textMuted },
  stepNumOn: { color: colors.white },
  stepLabel: { marginTop: 4, fontSize: font.size.xs, color: colors.textMuted },
  stepLabelOn: { color: colors.primary, fontWeight: font.semibold },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.surfaceMuted, marginBottom: 18 },
  stepLineOn: { backgroundColor: colors.primary },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x2, gap: 8 },
  loader: { marginTop: spacing.x3 },
  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: spacing.md, marginBottom: 8 },
  helper: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: spacing.md },

  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...cardShadow },
  infoLabel: { fontSize: font.size.sm, color: colors.textMuted },
  infoValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary, marginTop: 2 },

  pickList: { gap: 8, marginTop: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.white },
  pickRowOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  pickLabel: { flex: 1, fontSize: font.size.sm, color: colors.text },
  pickAmt: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary },

  amountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...cardShadow },
  amountValue: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.primary },
  amountHint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },

  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  methodRowOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  methodLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  methodLabelOn: { color: colors.primary },
  methodSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  optionsRow: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  optionDone: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  optionText: { fontSize: font.size.xs, color: colors.text, fontWeight: font.medium, textAlign: 'center' },
  preview: { height: 260, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  proofNote: { marginTop: 10, fontSize: font.size.xs, color: colors.textLight, textAlign: 'center' },

  confirm: { alignItems: 'center', paddingTop: spacing.x3 },
  successCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.green[500], alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { marginTop: spacing.lg, fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary },
  confirmSub: { marginTop: 4, fontSize: font.size.md, color: colors.textMuted },
  recap: { width: '100%', backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, marginTop: spacing.x2, ...cardShadow },
  recapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  recapDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  recapLabel: { fontSize: font.size.md, color: colors.textMuted },
  recapValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  recapStatus: { fontSize: font.size.md, fontWeight: font.bold, color: colors.success },
  recapStatusPending: { fontSize: font.size.md, fontWeight: font.bold, color: colors.warning },

  emptyBox: { alignItems: 'center', paddingTop: spacing.x4, gap: 8 },
  emptyTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text, marginTop: 8 },
  emptyText: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center' },

  bottom: { padding: spacing.lg },
  cta: { minHeight: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.white, fontSize: font.size.base, fontWeight: font.semibold },
});
