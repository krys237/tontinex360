'use client';
import { useEffect, useRef, useState } from 'react';

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://tontine-project.onrender.com/api')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://')
  .replace(/\/api\/?$/, '');

export interface ChatSocketMessage {
  type: string;
  [k: string]: any;
}

export type ChatStatus = 'connecting' | 'live' | 'offline';

/**
 * Hook chat tolérant à l'échec :
 * - Essaie d'ouvrir un WebSocket pour le temps réel
 * - Si le WS échoue (handshake 500, blocage proxy, etc.), reste en mode
 *   « offline » et expose le statut pour que l'UI bascule sur du polling REST
 * - `send` retourne `false` si le WS n'est pas connecté ; l'appelant doit
 *   alors envoyer via REST
 */
export function useChatSocket(
  conversationId: string | null,
  onMessage: (msg: ChatSocketMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ChatStatus>('offline');

  useEffect(() => {
    if (!conversationId) {
      setStatus('offline');
      return;
    }
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    setStatus('connecting');
    const url = `${WS_BASE}/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      setStatus('offline');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setStatus('live');
    ws.onclose = () => setStatus('offline');
    ws.onerror = () => setStatus('offline');

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage(data);
      } catch {
        // ignore
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      setStatus('offline');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  /** Tente d'envoyer via WS. Retourne true si OK, false sinon (=> fallback REST). */
  const send = (msg: ChatSocketMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  return { send, status };
}
