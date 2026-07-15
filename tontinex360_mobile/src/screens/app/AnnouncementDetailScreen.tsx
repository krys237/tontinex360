import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Chip, IconBubble } from '../../components/ui';
import { governanceApi, type Announcement } from '../../lib/api/governance';
import type { AppStackParamList } from '../../navigation/types';
import { API_URL } from '../../config/env';
import { formatDateFr } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type DetailRoute = RouteProp<AppStackParamList, 'AnnouncementDetail'>;

/** Priority -> chip mapping (null = no chip for normal/low). */
function priorityChip(p?: Announcement['priority']) {
  if (p === 'urgent') return { label: 'Urgent', tint: 'danger' as const };
  if (p === 'high') return { label: 'Important', tint: 'gold' as const };
  return null;
}

/** Resolve a possibly-relative attachment URL against the API origin. */
function resolveAttachment(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_URL.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function AnnouncementDetailScreen() {
  const insets = useSafeAreaInsets();
  const { params } = useRoute<DetailRoute>();
  const qc = useQueryClient();

  // Use the already-loaded list item as instant placeholder, then refresh.
  const placeholder = (qc.getQueryData<Announcement[]>(['announcements']) ?? []).find(
    (a) => a.id === params.id,
  );

  const annQ = useQuery({
    queryKey: ['announcement', params.id],
    queryFn: () => governanceApi.getAnnouncement(params.id),
    initialData: placeholder,
  });

  // Mark as read on open (idempotent), then refresh the feed + badges.
  useEffect(() => {
    let cancelled = false;
    governanceApi
      .markAnnouncementRead(params.id)
      .then(() => {
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ['announcements'] });
        qc.invalidateQueries({ queryKey: ['announcements', 'unread'] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [params.id, qc]);

  const a = annQ.data;

  if (!a) {
    return (
      <View style={styles.center}>
        {annQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.empty}>Annonce introuvable.</Text>
        )}
      </View>
    );
  }

  const chip = priorityChip(a.priority);
  const dateLabel = formatDateFr(a.created_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.x3 }]}>
      <View style={styles.metaRow}>
        {chip ? <Chip label={chip.label} tint={chip.tint} /> : null}
        {a.is_pinned ? (
          <View style={styles.pinned}>
            <Ionicons name="pin" size={12} color={colors.primary} />
            <Text style={styles.pinnedText}>Épinglée</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{a.title}</Text>

      <View style={styles.authorRow}>
        <IconBubble icon="megaphone-outline" tint="lime" size={34} />
        <View style={styles.flex}>
          <Text style={styles.author}>{a.author_name || 'Bureau'}</Text>
          {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
        </View>
      </View>

      <View style={styles.divider} />

      {a.content ? <Text style={styles.body}>{a.content}</Text> : null}

      {a.attachment ? (
        <Pressable
          style={styles.attachment}
          onPress={() => Linking.openURL(resolveAttachment(a.attachment as string))}>
          <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
          <Text style={styles.attachmentText}>Voir la pièce jointe</Text>
          <Ionicons name="open-outline" size={16} color={colors.textLight} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.textMuted, fontSize: font.size.md },
  flex: { flex: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinnedText: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.semibold },

  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, lineHeight: font.size.x2 * 1.25 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  author: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  date: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

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
    marginTop: 8,
    ...cardShadow,
  },
  attachmentText: { flex: 1, fontSize: font.size.md, fontWeight: font.semibold, color: colors.primary },
});
