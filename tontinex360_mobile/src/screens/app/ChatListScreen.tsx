import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { IconBubble } from '../../components/ui';
import { chatApi } from '../../lib/api/chat';
import type { Conversation } from '../../lib/types/chat';
import { useAuthStore } from '../../lib/stores/auth-store';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { timeAgo, textOf } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function convDisplay(c: Conversation, myId?: string): { name: string; icon: IoniconName; typeIcon: IoniconName } {
  if (c.conv_type === 'private') {
    const other = c.members.find((m) => m.membership !== myId);
    return { name: other?.member_name || 'Conversation', icon: 'person-circle-outline', typeIcon: 'person' };
  }
  if (c.conv_type === 'general') return { name: c.name || 'Canal général', icon: 'megaphone-outline', typeIcon: 'megaphone' };
  return { name: c.name || 'Groupe', icon: 'people-outline', typeIcon: 'people' };
}

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const myId = useAuthStore((s) => s.currentMembership?.id);
  const { isBureau } = usePermissions();
  const [modalOpen, setModalOpen] = useState(false);

  // Rafraîchit la liste (dernier message + non-lus) toutes les 5 s, comme le web.
  // Indispensable tant que le WebSocket temps réel n'est pas opérationnel.
  const listQ = useQuery({ queryKey: ['conversations'], queryFn: chatApi.conversations, refetchInterval: 5000 });

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

  const generalMut = useMutation({
    mutationFn: () => chatApi.getOrCreateGeneral(),
    onSuccess: (conv) => {
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      navigation.navigate('Conversation', { id: conv.id, title: conv.name || 'Canal général' });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const conversations = [...(listQ.data ?? [])].sort((a, b) =>
    (b.last_message_at ?? b.created_at ?? '').localeCompare(a.last_message_at ?? a.created_at ?? ''),
  );

  const goPrivate = () => { setModalOpen(false); navigation.navigate('ChatNewPrivate'); };
  const goGroup = () => { setModalOpen(false); navigation.navigate('ChatNewGroup'); };

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
        refreshControl={
          <RefreshControl refreshing={listQ.isRefetching} onRefresh={listQ.refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Conversations <Text style={styles.headerCount}>({conversations.length})</Text>
            </Text>
            <Pressable style={styles.newBtn} onPress={() => setModalOpen(true)}>
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.newBtnText}>Nouvelle</Text>
            </Pressable>
          </View>
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
          const preview = textOf(item.last_message) || item.description || 'Pas encore de message';
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', { id: item.id, title: d.name })}>
              <IconBubble icon={d.icon} tint="white" size={44} />
              <View style={styles.flex}>
                <View style={styles.topRow}>
                  <View style={styles.nameWrap}>
                    <Ionicons name={d.typeIcon} size={12} color={colors.info} />
                    <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
                      {d.name}
                    </Text>
                  </View>
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

      {/* Modal : Nouvelle conversation */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Nouvelle conversation</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Option
              icon="person"
              tint="primary"
              title="Discuter avec un membre"
              desc="Réservé au président et aux membres du bureau."
              disabled={!isBureau}
              onPress={goPrivate}
            />
            <Option
              icon="people"
              tint="accent"
              title="Créer un groupe"
              desc="Réservé au président et aux membres du bureau."
              disabled={!isBureau}
              onPress={goGroup}
            />
            <Option
              icon="megaphone"
              tint="lime"
              title="Canal général de l'association"
              desc="Lu et accessible à TOUS les membres actifs."
              loading={generalMut.isPending}
              onPress={() => generalMut.mutate()}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Option({
  icon, tint, title, desc, disabled, loading, onPress,
}: {
  icon: IoniconName;
  tint: 'primary' | 'accent' | 'lime';
  title: string;
  desc: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.option, disabled && styles.optionDisabled]}
      onPress={disabled || loading ? undefined : onPress}>
      <IconBubble icon={icon} tint={disabled ? 'primary' : tint} size={40} outline style={disabled ? { opacity: 0.4 } : undefined} />
      <View style={styles.flex}>
        <Text style={[styles.optionTitle, disabled && styles.optionTextMuted]}>{title}</Text>
        <Text style={[styles.optionDesc, disabled && styles.optionTextMuted]}>{desc}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: 10, flexGrow: 1 },
  loader: { marginTop: spacing.x3 },
  empty: { textAlign: 'center', marginTop: spacing.x3, color: colors.textMuted, fontSize: font.size.md },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  headerCount: { color: colors.textLight, fontWeight: font.semibold },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  newBtnText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.bold },

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
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  sheetTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  optionDisabled: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  optionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  optionDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  optionTextMuted: { color: colors.textLight },
});
