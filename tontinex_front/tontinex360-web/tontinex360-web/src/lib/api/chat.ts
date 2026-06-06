import api from './client';
import type { Conversation, Message } from '@/lib/types/chat';

export const chatApi = {
  conversations: () => api.get<Conversation[]>('/chat/conversations/').then(r => r.data),
  messages: (conversationId: string) =>
    api.get<Message[]>(`/chat/conversations/${conversationId}/messages/`).then(r => r.data),
  send: (conversationId: string, data: { content: string; message_type?: string; reply_to?: string }) =>
    api.post<Message>(`/chat/conversations/${conversationId}/send/`, data).then(r => r.data),
  markRead: (conversationId: string) =>
    api.post(`/chat/conversations/${conversationId}/read/`),
  createPrivate: (memberId: string) =>
    api.post<Conversation>('/chat/conversations/private/', { member_id: memberId }).then(r => r.data),
  createGroup: (data: { name: string; member_ids: string[]; description?: string }) =>
    api.post<Conversation>('/chat/conversations/group/', data).then(r => r.data),
  /** Récupère ou crée le canal général de l'association (tous les membres). */
  getOrCreateGeneral: () =>
    api.post<Conversation>('/chat/conversations/general/').then(r => r.data),
};
