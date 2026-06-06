/**
 * Chat WebSocket hook (Django Channels).
 *
 * Connects to  wss://<host>/ws/chat/<conversationId>/?token=<JWT>  and dispatches
 * the server frames (chat.message / chat.typing / chat.messages.read) to typed
 * handlers. Auto-reconnects with backoff. When it can't connect, `status` stays
 * 'offline' and the caller should fall back to REST polling (see ConversationScreen).
 *
 * Outgoing helpers mirror the consumer's `receive()` contract:
 *   sendMessage -> {type:'chat.message', content, message_type, reply_to, attachments}
 *   sendTyping  -> {type:'chat.typing', is_typing}
 *   sendRead    -> {type:'chat.read', message_ids}
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../../config/env';
import { tokenCache } from '../storage/secure-storage';
import type { Message } from '../types/chat';

export type SocketStatus = 'connecting' | 'live' | 'offline';

export interface ChatSocketHandlers {
  onMessage?: (m: Message) => void;
  onTyping?: (t: { userId: string; userName: string; isTyping: boolean }) => void;
  onRead?: (r: { userId: string; messageIds: string[] }) => void;
}

export interface ChatSocket {
  status: SocketStatus;
  sendMessage: (
    content: string,
    opts?: { messageType?: string; replyTo?: string | null; attachments?: unknown[] },
  ) => boolean;
  sendTyping: (isTyping: boolean) => boolean;
  sendRead: (messageIds: string[]) => boolean;
}

export function useChatSocket(
  conversationId: string | null,
  handlers: ChatSocketHandlers,
): ChatSocket {
  const [status, setStatus] = useState<SocketStatus>('offline');
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;
    if (!conversationId) {
      setStatus('offline');
      return;
    }

    const connect = () => {
      const token = tokenCache.getAccess();
      if (!token) {
        setStatus('offline');
        return;
      }
      setStatus('connecting');
      const url = `${WS_URL}/chat/${conversationId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('live');
      };

      ws.onmessage = (event) => {
        let frame: any;
        try {
          frame = JSON.parse(event.data as string);
        } catch {
          return;
        }
        const h = handlersRef.current;
        switch (frame?.type) {
          case 'chat.message':
            if (frame.data) h.onMessage?.(frame.data as Message);
            break;
          case 'chat.typing':
            if (frame.data) {
              h.onTyping?.({
                userId: String(frame.data.user_id),
                userName: String(frame.data.user_name ?? ''),
                isTyping: !!frame.data.is_typing,
              });
            }
            break;
          case 'chat.messages.read':
            if (frame.data) {
              h.onRead?.({
                userId: String(frame.data.user_id),
                messageIds: frame.data.message_ids ?? [],
              });
            }
            break;
          default:
            break;
        }
      };

      ws.onerror = () => {
        // The close handler schedules the reconnect.
      };

      ws.onclose = () => {
        wsRef.current = null;
        setStatus('offline');
        if (closedRef.current) return;
        const delay = Math.min(15000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
      setStatus('offline');
    };
  }, [conversationId]);

  const rawSend = useCallback((payload: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendMessage = useCallback<ChatSocket['sendMessage']>(
    (content, opts) =>
      rawSend({
        type: 'chat.message',
        content,
        message_type: opts?.messageType ?? 'text',
        reply_to: opts?.replyTo ?? undefined,
        attachments: opts?.attachments ?? [],
      }),
    [rawSend],
  );

  const sendTyping = useCallback<ChatSocket['sendTyping']>(
    (isTyping) => rawSend({ type: 'chat.typing', is_typing: isTyping }),
    [rawSend],
  );

  const sendRead = useCallback<ChatSocket['sendRead']>(
    (messageIds) => rawSend({ type: 'chat.read', message_ids: messageIds }),
    [rawSend],
  );

  return { status, sendMessage, sendTyping, sendRead };
}
