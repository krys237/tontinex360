import React, { useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import Signature from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export interface SignSubject {
  title: string;
  memberName: string;
  /** Montant mis en avant (bordereau). Omis pour l'enregistrement d'une signature de référence. */
  amount?: string;
  contextLine?: string;
}

/**
 * Bordereau de signature (cotisation / remboursement) — adapté au mobile.
 * Affiche la signature de référence + une zone de signature tactile (canvas
 * via react-native-signature-canvas → nécessite react-native-webview natif).
 */
export default function SignatureModal({
  visible,
  subject,
  referenceSignatureUrl,
  signFn,
  onClose,
  onSigned,
  note,
  primaryLabel = 'Signer et générer',
  showReference = true,
}: {
  visible: boolean;
  subject: SignSubject;
  referenceSignatureUrl?: string | null;
  signFn: (signature: string, deviceInfo: Record<string, any>) => Promise<any>;
  onClose: () => void;
  onSigned: () => void;
  /** Texte d'avertissement sous le canvas (défaut : bordereau de réception). */
  note?: string;
  /** Libellé du bouton principal. */
  primaryLabel?: string;
  /** Masque le bloc « Signature de référence » (ex. quand on ENREGISTRE la référence). */
  showReference?: boolean;
}) {
  const ref = useRef<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOK = async (sig: string) => {
    try {
      setSubmitting(true);
      await signFn(sig, { platform: Platform.OS, signed_via: 'mobile', signed_at: new Date().toISOString() });
      onSigned();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Signature impossible pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmpty = () => Alert.alert('Signature requise', 'Veuillez signer dans la zone prévue avant de valider.');

  // Masque le footer natif du canvas (on utilise nos propres boutons).
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; }
    body, html { width: 100%; height: 100%; margin: 0; }
  `;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.title}>{subject.title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Sujet */}
          <View style={styles.subjectBox}>
            <Text style={styles.subjectMember}>{subject.memberName}</Text>
            {subject.amount ? <Text style={styles.subjectAmount}>{subject.amount}</Text> : null}
            {subject.contextLine ? <Text style={styles.subjectCtx}>{subject.contextLine}</Text> : null}
          </View>

          {/* Référence */}
          {showReference ? (
            <>
              <Text style={styles.fieldLabel}>Signature de référence</Text>
              {referenceSignatureUrl ? (
                <Image source={{ uri: referenceSignatureUrl }} style={styles.refImage} resizeMode="contain" />
              ) : (
                <View style={styles.refEmpty}>
                  <Text style={styles.refEmptyText}>Aucune signature de référence.</Text>
                </View>
              )}
            </>
          ) : null}

          {/* Signature du jour */}
          <Text style={styles.fieldLabel}>Signature du jour *</Text>
          <View style={styles.canvasBox}>
            <Signature
              ref={ref}
              onOK={handleOK}
              onEmpty={handleEmpty}
              webStyle={webStyle}
              autoClear={false}
              imageType="image/png"
              backgroundColor="rgba(255,255,255,1)"
              penColor={colors.text}
            />
          </View>
          <Pressable onPress={() => ref.current?.clearSignature()} style={styles.clearBtn} hitSlop={8}>
            <Ionicons name="refresh" size={13} color={colors.textMuted} />
            <Text style={styles.clearText}>Effacer</Text>
          </Pressable>

          <Text style={styles.note}>
            {note ??
              "En signant, le bénéficiaire confirme l'opération. Un bordereau PDF horodaté avec hash d'intégrité sera généré."}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={submitting}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={() => ref.current?.readSignature()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },

  subjectBox: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  subjectMember: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  subjectAmount: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary },
  subjectCtx: { fontSize: font.size.xs, color: colors.textMuted },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginTop: 4 },
  refImage: { width: '100%', height: 70, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  refEmpty: { height: 56, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  refEmptyText: { fontSize: font.size.xs, color: colors.textLight },

  canvasBox: { height: 180, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', overflow: 'hidden' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  clearText: { fontSize: font.size.xs, color: colors.textMuted },

  note: { fontSize: font.size.xs, color: colors.textLight, fontStyle: 'italic', marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.6 },
});
