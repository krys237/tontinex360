import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { Card, IconBubble } from '../../components/ui';
import { memberImportsApi } from '../../lib/api/member-imports';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

const STEPS = [
  { num: 1, label: 'Fichier' },
  { num: 2, label: 'Aperçu & mode' },
  { num: 3, label: 'Résultat' },
];

const FORMAT_LINES = [
  'telephone (obligatoire) — synonymes : phone, tel, mobile, numero',
  'first_name — synonymes : prenom, prénom, firstname',
  'last_name — synonymes : nom, lastname, surname',
  'email (optionnel)',
  'member_number (optionnel) — synonymes : matricule, code',
];

export default function BureauImportScreen() {
  const historyQ = useQuery({
    queryKey: ['bureau', 'member-imports'],
    queryFn: () => memberImportsApi.list(),
    retry: false,
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={historyQ.isRefetching} onRefresh={() => historyQ.refetch()} tintColor={colors.primary} />}
      >
        {/* Stepper */}
        <View style={styles.stepper}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <View style={styles.step}>
                <View style={[styles.stepBadge, i === 0 && styles.stepBadgeActive]}>
                  <Text style={[styles.stepNum, i === 0 && styles.stepNumActive]}>{s.num}</Text>
                </View>
                <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{s.label}</Text>
              </View>
              {i < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
            </React.Fragment>
          ))}
        </View>

        {/* Téléverser */}
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <IconBubble icon="document-text" tint="primary" size={36} />
            <Text style={styles.cardTitle}>Téléverser un fichier Excel</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Format attendu : .xlsx (en-têtes flexibles)</Text>
            {FORMAT_LINES.map((l) => (
              <Text key={l} style={styles.infoLine}>• {l}</Text>
            ))}
          </View>

          <Pressable
            style={styles.templateBtn}
            onPress={() => Alert.alert('Modèle vierge', 'Téléchargez le modèle .xlsx depuis la version web pour le moment.')}
          >
            <Ionicons name="download-outline" size={16} color={colors.primary} />
            <Text style={styles.templateText}>Télécharger un modèle vierge</Text>
          </Pressable>

          {/* Zone d'upload — désactivée (picker non disponible) */}
          <View style={styles.dropZone}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.textLight} />
            <Text style={styles.dropText}>Sélection de fichier bientôt disponible</Text>
            <Text style={styles.dropHint}>Nécessite une mise à jour de l'application.</Text>
          </View>
        </Card>

        {/* Historique */}
        <Text style={styles.sectionLabel}>Historique des imports</Text>
        {historyQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (historyQ.data ?? []).length === 0 ? (
          <Text style={styles.empty}>Aucun import pour le moment.</Text>
        ) : (
          (historyQ.data ?? []).map((b) => (
            <View key={b.id} style={styles.row}>
              <IconBubble icon="cloud-done" tint="lime" size={40} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>{b.filename || 'Import'}</Text>
                <Text style={styles.rowSub}>
                  {b.mode === 'invite' ? 'Invitation' : 'Direct'} · {formatDateFr(b.created_at, false)}
                </Text>
              </View>
              <View style={styles.counts}>
                <Text style={styles.ok}>✓ {b.success_count}</Text>
                <Text style={styles.skip}>↺ {b.skipped_count}</Text>
                <Text style={styles.err}>✗ {b.error_count}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },

  stepper: { flexDirection: 'row', alignItems: 'center' },
  step: { alignItems: 'center', gap: 4 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepBadgeActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.textMuted },
  stepNumActive: { color: colors.white },
  stepLabel: { fontSize: 10, color: colors.textLight },
  stepLabelActive: { color: colors.text, fontWeight: font.semibold },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.border, marginHorizontal: 6, marginBottom: 16 },

  card: { borderRadius: radius.lg, gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  infoBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  infoTitle: { fontSize: font.size.xs, fontWeight: font.bold, color: '#7A5B10', marginBottom: 2 },
  infoLine: { fontSize: font.size.xs, color: '#8A6D1E' },
  templateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm },
  templateText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  dropZone: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.x3, alignItems: 'center', gap: 4 },
  dropText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.semibold },
  dropHint: { fontSize: font.size.xs, color: colors.textLight },

  sectionLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  counts: { alignItems: 'flex-end' },
  ok: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.semibold },
  skip: { fontSize: font.size.xs, color: colors.goldAccent },
  err: { fontSize: font.size.xs, color: colors.danger },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
