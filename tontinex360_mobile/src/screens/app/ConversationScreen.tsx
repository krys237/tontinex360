import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { chatApi } from '../../lib/api/chat';
import type { Message } from '../../lib/types/chat';
import { useChatSocket } from '../../lib/ws/use-chat-socket';
import { useAuthStore } from '../../lib/stores/auth-store';
import { textOf } from '../../lib/utils/format';
import type { AppStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type ConvRoute = RouteProp<AppStackParamList, 'Conversation'>;

function hhmm(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function mergeSorted(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function ConversationScreen() {
  const { params } = useRoute<ConvRoute>();
  const { id } = params;
  const qc = useQueryClient();
  const myId = useAuthStore((s) => s.currentMembership?.id);
  const myUserId = useAuthStore((s) => s.user?.id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => mergeSorted(prev, incoming));
  }, []);

  const socket = useChatSocket(id, {
    onMessage: (m) => merge([m]),
    onTyping: ({ userId, userName, isTyping }) => {
      if (userId === myUserId) return; // ignore my own typing echo
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTyping) {
        setTypingName(userName || 'Quelqu’un');
        typingTimer.current = setTimeout(() => setTypingName(null), 4000);
      } else {
        setTypingName(null);
      }
    },
  });

  // History + REST polling fallback while the socket is offline.
  const messagesQ = useQuery({
    queryKey: ['messages', id],
    queryFn: () => chatApi.messages(id),
    refetchInterval: socket.status === 'live' ? false : 2500,
  });

  useEffect(() => {
    if (messagesQ.data) merge(messagesQ.data);
  }, [messagesQ.data, merge]);

  // Mark the conversation read on open, and refresh the list badge.
  useEffect(() => {
    chatApi
      .markRead(id)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations'] }))
      .catch(() => {});
  }, [id, qc]);

  const onChangeText = (text: string) => {
    setInput(text);
    socket.sendTyping(true);
    if (selfTypingTimer.current) clearTimeout(selfTypingTimer.current);
    selfTypingTimer.current = setTimeout(() => socket.sendTyping(false), 1500);
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    socket.sendTyping(false);
    const sentViaWs = socket.sendMessage(text);
    if (sentViaWs) return; // the broadcast echo will append it
    setSending(true);
    try {
      const msg = await chatApi.send(id, { content: text });
      merge([msg]);
    } catch {
      setInput(text); // restore so the user can retry
    } finally {
      setSending(false);
    }
  };

  // Inverted list shows newest at the bottom.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const renderItem = ({ item }: { item: Message }) => {
    if (item.message_type === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{textOf(item.content)}</Text>
        </View>
      );
    }
    const mine = item.sender === myId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine && item.sender_name ? <Text style={styles.author}>{item.sender_name}</Text> : null}
          {textOf(item.reply_preview) ? (
            <View style={styles.replyBox}>
              <Text style={styles.replyText} numberOfLines={1}>
                {textOf(item.reply_preview)}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.msgText, mine && styles.msgTextMine]}>{textOf(item.content)}</Text>
          <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{hhmm(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {messagesQ.isLoading && messages.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Démarrez la conversation 👋</Text>}
            renderItem={renderItem}
          />
        )}

        {socket.status === 'offline' ? (
          <View style={styles.banner}>
            <Ionicons name="cloud-offline-outline" size={13} color={colors.textMuted} />
            <Text style={styles.bannerText}>Hors ligne — reconnexion…</Text>
          </View>
        ) : null}

        {typingName ? <Text style={styles.typing}>{typingName} écrit…</Text> : null}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={onChangeText}
            placeholder="Votre message…"
            placeholderTextColor={colors.textLight}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!input.trim() || sending}>
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  loader: { marginTop: spacing.x3 },
  list: { padding: spacing.lg, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.size.md, transform: [{ scaleY: -1 }] },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  author: { fontSize: font.size.xs, fontWeight: font.bold, color: colors.green[600], marginBottom: 2 },
  replyBox: {
    borderLeftWidth: 2,
    borderLeftColor: colors.green[400],
    paddingLeft: 6,
    marginBottom: 4,
    opacity: 0.9,
  },
  replyText: { fontSize: font.size.xs, color: colors.textMuted },
  msgText: { fontSize: font.size.md, color: colors.text, lineHeight: font.size.md * 1.35 },
  msgTextMine: { color: colors.white },
  msgTime: { fontSize: 10, color: colors.textLight, alignSelf: 'flex-end', marginTop: 2 },
  msgTimeMine: { color: 'rgba(255,255,255,0.8)' },

  systemRow: { alignItems: 'center', paddingVertical: 4 },
  systemText: { fontSize: font.size.xs, color: colors.textMuted, fontStyle: 'italic' },

  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  bannerText: { fontSize: font.size.xs, color: colors.textMuted },
  typing: { fontSize: font.size.xs, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: 2 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: font.size.md,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.green[400], opacity: 0.6 },
});
