/** Wire types. These mirror the backend's Pydantic schemas one-to-one. */

export interface UserPublic {
  id: number;
  phone: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  about: string | null;
  avatar_url: string | null;
  avatar_color: string;
  last_seen_at: string | null;
  online: boolean;
}

export interface UserSettings {
  read_receipts: boolean;
  typing_indicators: boolean;
}

export interface UserMe extends UserPublic {
  settings: UserSettings;
}

export interface AuthResponse {
  token: string;
  user: UserMe;
  needs_profile: boolean;
}

export interface Attachment {
  id: number;
  url: string;
  name: string;
  mime: string;
  size: number;
}

export type MessageKind = "text" | "attachment" | "system";
export type ServerStatus = "sent" | "delivered" | "read";

export interface QuotedMessage {
  id: number;
  sender_id: number | null;
  kind: MessageKind;
  body: string | null;
  attachment: Attachment | null;
  deleted: boolean;
}

export interface Reaction {
  user_id: number;
  emoji: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  client_id: string | null;
  kind: MessageKind;
  body: string | null;
  meta: Record<string, unknown> | null;
  reply_to: QuotedMessage | null;
  attachment: Attachment | null;
  reactions: Reaction[];
  status: ServerStatus | null;
  created_at: string;
  expires_at: string | null;
  deleted: boolean;
}

export interface MessagePage {
  items: Message[];
  has_more: boolean;
}

export type ConversationType = "direct" | "group";
export type MemberRole = "admin" | "member";

export interface Conversation {
  id: number;
  type: ConversationType;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  disappearing_seconds: number | null;
  created_at: string;
  last_message_at: string | null;
  last_message: Message | null;
  unread_count: number;
  last_read_message_id: number;
  my_role: MemberRole;
  peer: UserPublic | null;
  member_count: number;
}

export interface Member {
  user: UserPublic;
  role: MemberRole;
  joined_at: string;
}

export interface Contact {
  id: number;
  nickname: string | null;
  user: UserPublic;
  created_at: string;
}

export interface SearchResult {
  conversations: Conversation[];
  contacts: Contact[];
  messages: { message: Message; conversation_id: number }[];
}

export interface ReadState {
  conversation_id: number;
  last_read_message_id: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
