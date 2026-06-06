// Chat REST API. The WebSocket (real-time) lives in lib/ws/use-chat-socket.ts;
// these endpoints cover listing, history, the REST send fallback and creation.
import api, { unwrap, Paginated } from './client';
import type { Conversation, Message } from '../types/chat';

export interface SendMessageInput {
  content: string;
  message_type?: string;
  reply_to?: string | null;
  attachments?: unknown[];
}

export const chatApi = {
  /** My conversations (general + groups + private), tenant-scoped to the caller. */
  conversations: () =>
    api
      .get<Conversation[] | Paginated<Conversation>>('/chat/conversations/')
      .then((r) => unwrap(r.data)),

  conversation: (id: string) =>
    api.get<Conversation>(`/chat/conversations/${id}/`).then((r) => r.data),

  /** Last 50 messages, oldest-first. */
  messages: (id: string) =>
    api
      .get<Message[] | Paginated<Message>>(`/chat/conversations/${id}/messages/`)
      .then((r) => unwrap(r.data)),

  /** REST send (fallback when the WebSocket isn't connected). */
  send: (id: string, data: SendMessageInput) =>
    api.post<Message>(`/chat/conversations/${id}/send/`, data).then((r) => r.data),

  markRead: (id: string) =>
    api.post(`/chat/conversations/${id}/read/`).then((r) => r.data),

  /** Get (or create, bureau-only on first call) the association's general channel. */
  getOrCreateGeneral: () =>
    api.post<Conversation>('/chat/conversations/general/').then((r) => r.data),

  /** Create a group (bureau/president only). */
  createGroup: (data: { name: string; member_ids: string[]; description?: string }) =>
    api.post<Conversation>('/chat/conversations/group/', data).then((r) => r.data),

  /** Open (or fetch) a 1-to-1 conversation with another member. */
  createPrivate: (memberId: string) =>
    api.post<Conversation>('/chat/conversations/private/', { member_id: memberId }).then((r) => r.data),
};
