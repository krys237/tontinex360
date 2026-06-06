// Chat domain types — mirror the backend serializers (apps/chat/serializers.py).

export type ConversationType = 'private' | 'group' | 'bureau' | 'session' | 'general';
export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'system';

export interface ConversationMember {
  id: string;
  conversation: string;
  membership: string;
  member_name: string;
  role: 'member' | 'admin';
  unread_count: number;
  last_read_at?: string | null;
  is_muted: boolean;
  is_pinned: boolean;
  joined_at?: string;
}

export interface LastMessage {
  sender: string | null;
  content: string;
  at: string;
}

export interface Conversation {
  id: string;
  name: string;
  conv_type: ConversationType;
  description: string;
  members: ConversationMember[];
  last_message?: LastMessage | null;
  last_message_at?: string | null;
  message_count: number;
  my_unread_count: number;
  is_active: boolean;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender: string | null; // membership id of the author (null for system)
  sender_name: string | null;
  content: string;
  message_type: MessageType;
  reply_to?: string | null;
  reply_preview?: string | null;
  attachments: unknown[];
  is_deleted: boolean;
  created_at: string;
}
