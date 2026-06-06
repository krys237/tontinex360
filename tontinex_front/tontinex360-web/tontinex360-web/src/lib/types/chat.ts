export type ConversationType = 'private' | 'group' | 'bureau' | 'session' | 'general';
export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'system';

export interface Conversation {
  id: string;
  name: string;
  conv_type: ConversationType;
  description: string;
  members: ConversationMember[];
  last_message?: { sender: string; content: string; at: string };
  last_message_at?: string;
  message_count: number;
  my_unread_count: number;
  is_active: boolean;
}

export interface ConversationMember {
  membership: string;
  member_name: string;
  role: 'member' | 'admin';
  unread_count: number;
  is_muted: boolean;
}

export interface Message {
  id: string;
  conversation: string;
  sender: string;
  sender_name: string;
  content: string;
  message_type: MessageType;
  reply_to?: string;
  reply_preview?: string;
  attachments: any[];
  is_deleted: boolean;
  created_at: string;
}
