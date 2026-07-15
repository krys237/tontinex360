import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Chip, type ChipTint } from '../../components/ui';
import { cyclesApi } from '../../lib/api/cycles';
import type { Session, SessionStatus } from '../../lib/types/cycle';
import type { AppStackParamList } from '../../navigation/types';
import { formatDateFr } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type DetailRoute = RouteProp<AppStackParamList, 'SessionDetail'>;

const STATUS: Record<SessionStatus, { label: string; tint: ChipTint }> = {
  scheduled: { label: 'Programmée', tint: 'green' },
  in_progress: { label: 'En cours', tint: 'gold' },
  completed: { label: 'Terminée', tint: 'grey' },
  cancelled: { label: 'Annulée', tint: 'danger' },
  postponed: { label: 'Reportée', tint: 'gold' },
};

function hhmm(t?: string | null) {
  return t ? t.slice(0, 5).replace(':', 'h') : '';
}

function InfoLine({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { params } = useRoute<DetailRoute>();
  const qc = useQueryClient();

  const placeholder = (qc.getQueryData<Session[]>(['sessions']) ?? []).find((s) => s.id === params.id);

  const sQ = useQuery({
    queryKey: ['session', params.id],
    queryFn: () => cyclesApi.getSession(params.id),
    initialData: placeholder,
  });

  const s = sQ.data;

  if (!s) {
    return (
      <View style={styles.center}>
        {sQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.empty}>Séance introuvable.</Text>
        )}
      </View>
    );
  }

  const status = STATUS[s.status] ?? { label: s.status, tint: 'grey' as ChipTint };
  const dateLabel = formatDateFr(s.date, false);
  const timeLabel = s.start_time ? `${hhmm(s.start_time)}${s.end_time ? ` - ${hhmm(s.end_time)}` : ''}` : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.x3 }]}>
      <View style={styles.metaRow}>
        <Chip label="Séance" tint="green" />
        <Chip label={status.label} tint={status.tint} />
      </View>

      <Text style={styles.title}>Séance N°{s.session_number}</Text>

      <View style={styles.infoCard}>
        {dateLabel ? <InfoLine icon="calendar" text={dateLabel} /> : null}
        {timeLabel ? <InfoLine icon="time" text={timeLabel} /> : null}
        {s.location ? <InfoLine icon="location" text={s.location} /> : null}
        {s.host_member_name ? <InfoLine icon="person" text={`Hôte : ${s.host_member_name}`} /> : null}
      </View>

      {s.minutes ? (
        <>
          <Text style={styles.sectionTitle}>Compte rendu</Text>
          <Text style={styles.body}>{s.minutes}</Text>
        </>
      ) : null}

      {s.notes ? (
        <>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.body}>{s.notes}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.textMuted, fontSize: font.size.md },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, lineHeight: font.size.x2 * 1.25 },

  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: font.size.md, color: colors.text, fontWeight: font.medium, flex: 1 },

  sectionTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text, marginTop: 6 },
  body: { fontSize: font.size.md, color: colors.text, lineHeight: font.size.md * 1.6 },
});
