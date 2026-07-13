import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconBubble } from '../../components/ui';
import { notificationsApi } from '../../lib/api/notifications';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ['notifications', 'all'], queryFn: () => notificationsApi.list() });

  const markAll = async () => {
    await notificationsApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
    listQ.refetch();
  };

  const data = listQ.data ?? [];
  const hasUnread = data.some((n) => !n.is_read);

  return (
    <View style={styles.container}>
      {hasUnread ? (
        <Pressable onPress={markAll} style={styles.markAll} hitSlop={8}>
          <Text style={styles.markAllText}>Tout marquer comme lu</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={listQ.isRefetching} onRefresh={listQ.refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          listQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>Aucune notification.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.row, !item.is_read && styles.rowUnread]}>
            <IconBubble icon={item.is_read ? 'notifications-outline' : 'notifications'} tint="white" size={36} />
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
            </View>
            {!item.is_read ? <View style={styles.dot} /> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  markAll: { alignSelf: 'flex-end', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  markAllText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.size.sm },
  list: { padding: spacing.lg, gap: 10, flexGrow: 1 },
  loader: { marginTop: spacing.x3 },
  empty: { textAlign: 'center', marginTop: spacing.x3, color: colors.textMuted, fontSize: font.size.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.green[400], backgroundColor: colors.greenBg },
  flex: { flex: 1 },
  title: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  body: { marginTop: 2, fontSize: font.size.sm, color: colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green[500] },
});
