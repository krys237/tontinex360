import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Chip } from '../../components/ui';
import { eventsApi, EVENT_TYPE_LABEL, type AppEvent } from '../../lib/api/events';
import type { AppStackParamList } from '../../navigation/types';
import { API_URL } from '../../config/env';
import { formatDateFr } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type DetailRoute = RouteProp<AppStackParamList, 'EventDetail'>;

function hhmm(t?: string | null) {
  return t ? t.slice(0, 5).replace(':', 'h') : '';
}

function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_URL.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function InfoLine({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export default function EventDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const qc = useQueryClient();

  const placeholder = (qc.getQueryData<AppEvent[]>(['events']) ?? []).find((e) => e.id === params.id);

  const evQ = useQuery({
    queryKey: ['event', params.id],
    queryFn: () => eventsApi.get(params.id),
    initialData: placeholder,
  });

  const e = evQ.data;

  if (!e) {
    return (
      <View style={styles.center}>
        {evQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.empty}>Événement introuvable.</Text>
        )}
      </View>
    );
  }

  const typeLabel = EVENT_TYPE_LABEL[e.event_type] ?? 'Événement';
  const dateLabel = formatDateFr(e.date, false);
  const timeLabel = e.start_time ? `${hhmm(e.start_time)}${e.end_time ? ` - ${hhmm(e.end_time)}` : ''}` : '';
  const cancelled = e.status === 'cancelled';
  const attachments = Array.isArray(e.attachments) ? e.attachments : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.metaRow}>
        <Chip label={typeLabel} tint="green" />
        {cancelled ? <Chip label="Annulé" tint="danger" /> : null}
      </View>

      <Text style={styles.title}>{e.title}</Text>

      <View style={styles.infoCard}>
        {dateLabel ? <InfoLine icon="calendar" text={dateLabel} /> : null}
        {timeLabel ? <InfoLine icon="time" text={timeLabel} /> : null}
        {e.location ? <InfoLine icon="location" text={e.location} /> : null}
      </View>

      {e.description ? (
        <>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.body}>{e.description}</Text>
        </>
      ) : null}

      {e.minutes ? (
        <>
          <Text style={styles.sectionTitle}>Compte rendu</Text>
          <Text style={styles.body}>{e.minutes}</Text>
        </>
      ) : null}

      {attachments.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Pièces jointes</Text>
          {attachments.map((att: any, i: number) => {
            const url = typeof att === 'string' ? att : att?.url;
            const label = typeof att === 'string' ? `Pièce jointe ${i + 1}` : att?.name || `Pièce jointe ${i + 1}`;
            if (!url) return null;
            return (
              <Pressable key={i} style={styles.attachment} onPress={() => Linking.openURL(resolveUrl(url))}>
                <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
                <Text style={styles.attachmentText} numberOfLines={1}>
                  {label}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.textLight} />
              </Pressable>
            );
          })}
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

  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  attachmentText: { flex: 1, fontSize: font.size.md, fontWeight: font.semibold, color: colors.primary },
});
