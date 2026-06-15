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
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { chatApi } from '../../lib/api/chat';
import type { Message } from '../../lib/types/chat';
import { useChatSocket } from '../../lib/ws/use-chat-socket';
import { useAuthStore } from '../../lib/stores/auth-store';
import { textOf, formatDateFr } from '../../lib/utils/format';
import type { AppStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type ConvRoute = RouteProp<AppStackParamList, 'Conversation'>;

type Row =
  | { type: 'date'; key: string; label: string }
  | { type: 'msg'; key: string; msg: Message };

type ReplyTarget = { id: string; preview: string; author: string };

function hhmm(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yest.toDateString()) return 'Hier';
  return formatDateFr(iso, false);
}

function mergeSorted(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

const SWIPE_TRIGGER = 52; // px de glissement pour déclencher la réponse

/** Bulle de message glissable vers la droite pour répondre (RN pur, sans dépendance). */
function SwipeReplyBubble({
  mine,
  onReply,
  children,
}: {
  mine: boolean;
  onReply: () => void;
  children: React.ReactNode;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const dragged = useRef(0);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Ne capture que les glissements clairement horizontaux vers la droite,
        // pour laisser le scroll vertical à la FlatList.
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderMove: (_, g) => {
          const x = Math.max(0, Math.min(g.dx, 72));
          dragged.current = x;
          tx.setValue(x);
        },
        onPanResponderRelease: () => {
          const trigger = dragged.current >= SWIPE_TRIGGER;
          dragged.current = 0;
          Animated.spring(tx, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
          if (trigger) onReplyRef.current();
        },
        onPanResponderTerminate: () => {
          dragged.current = 0;
          Animated.spring(tx, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [tx],
  );

  const hintOpacity = tx.interpolate({ inputRange: [0, SWIPE_TRIGGER], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      <Animated.View style={[styles.replyHint, { opacity: hintOpacity }]} pointerEvents="none">
        <Ionicons name="arrow-undo" size={16} color={colors.green[600]} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
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
    const replyId = replyTo?.id;
    setInput('');
    setReplyTo(null);
    socket.sendTyping(false);
    const sentViaWs = socket.sendMessage(text, { replyTo: replyId });
    if (sentViaWs) return; // the broadcast echo will append it
    setSending(true);
    try {
      const msg = await chatApi.send(id, { content: text, reply_to: replyId ?? null });
      merge([msg]);
    } catch {
      setInput(text); // restore so the user can retry
    } finally {
      setSending(false);
    }
  };

  const onLongPressMessage = (m: Message) => {
    Alert.alert('Message', textOf(m.content).slice(0, 140) || undefined, [
      {
        text: 'Répondre',
        onPress: () =>
          setReplyTo({ id: m.id, preview: textOf(m.content), author: m.sender_name || '' }),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // Build rows (date separators + messages), then invert for the list.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    for (const m of messages) {
      const dk = dayKey(m.created_at);
      if (dk && dk !== lastDay) {
        out.push({ type: 'date', key: `date_${dk}`, label: dayLabel(m.created_at) });
        lastDay = dk;
      }
      out.push({ type: 'msg', key: m.id, msg: m });
    }
    return out.reverse();
  }, [messages]);

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSep}>
          <Text style={styles.dateSepText}>{item.label}</Text>
        </View>
      );
    }
    const m = item.msg;
    if (m.message_type === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{textOf(m.content)}</Text>
        </View>
      );
    }
    const mine = m.sender === myId;
    return (
      <SwipeReplyBubble
        mine={mine}
        onReply={() => setReplyTo({ id: m.id, preview: textOf(m.content), author: m.sender_name || '' })}>
        <Pressable
          onLongPress={() => onLongPressMessage(m)}
          delayLongPress={250}
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine && m.sender_name ? <Text style={styles.author}>{m.sender_name}</Text> : null}
          {textOf(m.reply_preview) ? (
            <View style={styles.replyBox}>
              <Text style={styles.replyText} numberOfLines={1}>
                {textOf(m.reply_preview)}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.msgText, mine && styles.msgTextMine]}>{textOf(m.content)}</Text>
          <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{hhmm(m.created_at)}</Text>
        </Pressable>
      </SwipeReplyBubble>
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
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Démarrez la conversation 👋</Text>}
            renderItem={renderItem}
          />
        )}

        {socket.status !== 'live' ? (
          <View style={styles.banner}>
            <Ionicons name="sync-outline" size={13} color={colors.textMuted} />
            <Text style={styles.bannerText}>Synchronisation réseau — messages mis à jour automatiquement</Text>
          </View>
        ) : null}

        {typingName ? <Text style={styles.typing}>{typingName} écrit…</Text> : null}

        {replyTo ? (
          <View style={styles.replyCompose}>
            <View style={styles.replyComposeBar} />
            <View style={styles.flex}>
              <Text style={styles.replyComposeAuthor} numberOfLines={1}>
                Réponse à {replyTo.author || 'message'}
              </Text>
              <Text style={styles.replyComposeText} numberOfLines={1}>
                {replyTo.preview}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

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

  dateSep: { alignItems: 'center', paddingVertical: 6 },
  dateSepText: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  replyHint: { position: 'absolute', left: 4, top: 0, bottom: 0, justifyContent: 'center' },
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

  replyCompose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginBottom: 6,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyComposeBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.green[500] },
  replyComposeAuthor: { fontSize: font.size.xs, fontWeight: font.bold, color: colors.green[600] },
  replyComposeText: { fontSize: font.size.sm, color: colors.textMuted },

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
