import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { IconBubble } from '../../components/ui';
import { chatApi } from '../../lib/api/chat';
import type { Conversation } from '../../lib/types/chat';
import { useAuthStore } from '../../lib/stores/auth-store';
import { timeAgo, textOf } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function convDisplay(c: Conversation, myId?: string): { name: string; icon: IoniconName } {
  if (c.conv_type === 'private') {
    const other = c.members.find((m) => m.membership !== myId);
    return { name: other?.member_name || 'Conversation', icon: 'person-circle-outline' };
  }
  if (c.conv_type === 'general') return { name: c.name || 'Canal général', icon: 'megaphone-outline' };
  return { name: c.name || 'Groupe', icon: 'people-outline' };
}

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const myId = useAuthStore((s) => s.currentMembership?.id);

  const listQ = useQuery({ queryKey: ['conversations'], queryFn: chatApi.conversations });

  // Best-effort: make sure the general channel exists / I'm a member of it.
  useEffect(() => {
    let cancelled = false;
    chatApi
      .getOrCreateGeneral()
      .then(() => {
        if (!cancelled) qc.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qc]);

  const conversations = [...(listQ.data ?? [])].sort((a, b) =>
    (b.last_message_at ?? b.created_at ?? '').localeCompare(a.last_message_at ?? a.created_at ?? ''),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={listQ.isRefetching} onRefresh={listQ.refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          listQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>Aucune conversation pour le moment.</Text>
          )
        }
        renderItem={({ item }) => {
          const d = convDisplay(item, myId);
          const unread = item.my_unread_count || 0;
          const preview = textOf(item.last_message) || item.description || 'Aucun message';
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', { id: item.id, title: d.name })}>
              <IconBubble icon={d.icon} tint={unread > 0 ? 'lime' : 'primary'} size={44} />
              <View style={styles.flex}>
                <View style={styles.topRow}>
                  <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
                    {d.name}
                  </Text>
                  {item.last_message_at ? <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text> : null}
                </View>
                <View style={styles.bottomRow}>
                  <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {preview}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: 10, flexGrow: 1 },
  loader: { marginTop: spacing.x3 },
  empty: { textAlign: 'center', marginTop: spacing.x3, color: colors.textMuted, fontSize: font.size.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  nameUnread: { fontWeight: font.bold },
  time: { fontSize: font.size.xs, color: colors.textLight },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  preview: { flex: 1, fontSize: font.size.sm, color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: font.medium },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: font.bold },
});
