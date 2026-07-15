import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Linking, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { AppVersionInfo } from '../lib/api/app-version';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadow';

/**
 * Fenêtre « Mise à jour disponible » (hors stores).
 * - `mandatory` = true : pas de bouton « Plus tard », impossible de fermer.
 * - Le bouton principal ouvre le lien de l'APK dans le navigateur (Android
 *   propose ensuite l'installation).
 */
export default function UpdateAvailableModal({
  visible,
  info,
  currentVersion,
  mandatory,
  onDismiss,
}: {
  visible: boolean;
  info: AppVersionInfo;
  currentVersion: string;
  mandatory: boolean;
  onDismiss: () => void;
}) {
  const download = async () => {
    if (!info.apk_url) {
      return Alert.alert(
        'Lien indisponible',
        "Le lien de téléchargement n'est pas encore configuré. Contactez l'administrateur.",
      );
    }
    try {
      const ok = await Linking.canOpenURL(info.apk_url);
      if (!ok) throw new Error('cannot open');
      await Linking.openURL(info.apk_url);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le lien de téléchargement.");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Bouton retour Android : bloqué si la mise à jour est obligatoire.
      onRequestClose={mandatory ? () => {} : onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="rocket-outline" size={28} color={colors.primary} />
          </View>

          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.versions}>
            Version {currentVersion} → <Text style={styles.versionNew}>{info.latest_version}</Text>
          </Text>

          {mandatory ? (
            <View style={styles.mandatoryBadge}>
              <Ionicons name="alert-circle" size={14} color={colors.warning} />
              <Text style={styles.mandatoryText}>Mise à jour requise pour continuer</Text>
            </View>
          ) : null}

          {info.notes ? (
            <ScrollView style={styles.notesBox} contentContainerStyle={styles.notesContent}>
              <Text style={styles.notes}>{info.notes}</Text>
            </ScrollView>
          ) : null}

          <Pressable style={styles.btnPrimary} onPress={download}>
            <Ionicons name="download-outline" size={18} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Télécharger la mise à jour</Text>
          </Pressable>

          {mandatory ? (
            <Text style={styles.hint}>
              Après le téléchargement, ouvrez le fichier pour installer la nouvelle version.
            </Text>
          ) : (
            <Pressable onPress={onDismiss} hitSlop={8} style={styles.laterBtn}>
              <Text style={styles.laterText}>Plus tard</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...cardShadow },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.heading, textAlign: 'center', marginTop: 4 },
  versions: { fontSize: font.size.sm, color: colors.textMuted },
  versionNew: { color: colors.primary, fontWeight: font.bold },

  mandatoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, marginTop: 2 },
  mandatoryText: { fontSize: font.size.xs, color: colors.warning, fontWeight: font.semibold },

  notesBox: { maxHeight: 160, alignSelf: 'stretch', backgroundColor: colors.bg, borderRadius: radius.md, marginTop: spacing.xs },
  notesContent: { padding: spacing.md },
  notes: { fontSize: font.size.sm, color: colors.text, lineHeight: font.size.sm * 1.5 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.primary, marginTop: spacing.sm },
  btnPrimaryText: { color: colors.white, fontSize: font.size.md, fontWeight: font.bold },

  hint: { fontSize: font.size.xs, color: colors.textLight, textAlign: 'center', marginTop: 4 },
  laterBtn: { paddingVertical: spacing.sm, marginTop: 2 },
  laterText: { color: colors.textMuted, fontWeight: font.semibold, fontSize: font.size.sm },
});
