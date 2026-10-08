import { http } from "./http";
import type {
  Attachment,
  AuthResponse,
  Contact,
  Conversation,
  Member,
  Message,
  MessagePage,
  ReadState,
  SearchResult,
  UserMe,
  UserPublic,
  UserSettings,
} from "./types";

export { ApiError, configureHttp } from "./http";
export * from "./types";

export const authApi = {
  requestOtp: (phone: string) =>
    http.post<{ phone: string; hint: string }>("/auth/request-otp", { phone }, { public: true }),
  verifyOtp: (phone: string, code: string) =>
    http.post<AuthResponse>("/auth/verify-otp", { phone, code }, { public: true }),
  logout: () => http.post<void>("/auth/logout"),
  me: () => http.get<UserMe>("/auth/me"),
};

export interface ProfilePatch {
  first_name?: string;
  last_name?: string | null;
  about?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  settings?: Partial<UserSettings>;
}

export const usersApi = {
  updateMe: (patch: ProfilePatch) => http.patch<UserMe>("/users/me", patch),
  lookup: (query: { phone?: string; username?: string }) =>
    http.get<UserPublic>("/users/lookup", query),
};

export const contactsApi = {
  list: () => http.get<Contact[]>("/contacts"),
  add: (input: { phone?: string; username?: string; nickname?: string }) =>
    http.post<Contact>("/contacts", input),
  rename: (id: number, nickname: string | null) =>
    http.patch<Contact>(`/contacts/${id}`, { nickname }),
  remove: (id: number) => http.delete(`/contacts/${id}`),
};

export interface ConversationPatch {
  name?: string;
  description?: string | null;
  avatar_url?: string | null;
  disappearing_seconds?: number;
}

export const conversationsApi = {
  list: () => http.get<Conversation[]>("/conversations"),
  get: (id: number) => http.get<Conversation>(`/conversations/${id}`),
  openDirect: (userId: number) =>
    http.post<Conversation>("/conversations/direct", { user_id: userId }),
  update: (id: number, patch: ConversationPatch) =>
    http.patch<Conversation>(`/conversations/${id}`, patch),
  markRead: (id: number, upToId: number) =>
    http.post<ReadState>(`/conversations/${id}/read`, { up_to_id: upToId }),
};

export const groupsApi = {
  create: (input: { name: string; member_ids: number[]; avatar_url?: string | null }) =>
    http.post<Conversation>("/groups", input),
  members: (id: number) => http.get<Member[]>(`/groups/${id}/members`),
  addMembers: (id: number, userIds: number[]) =>
    http.post<Member[]>(`/groups/${id}/members`, { user_ids: userIds }),
  removeMember: (id: number, userId: number) => http.delete(`/groups/${id}/members/${userId}`),
  setRole: (id: number, userId: number, role: "admin" | "member") =>
    http.patch<void>(`/groups/${id}/members/${userId}`, { role }),
  leave: (id: number) => http.post<void>(`/groups/${id}/leave`),
};

export interface SendInput {
  client_id: string;
  body?: string | null;
  reply_to_id?: number | null;
  attachment_id?: number | null;
}

export const messagesApi = {
  list: (
    conversationId: number,
    query: { before_id?: number; after_id?: number; limit?: number } = {},
  ) => http.get<MessagePage>(`/conversations/${conversationId}/messages`, query),
  send: (conversationId: number, input: SendInput) =>
    http.post<Message>(`/conversations/${conversationId}/messages`, input),
  remove: (id: number) => http.delete(`/messages/${id}`),
  react: (id: number, emoji: string) => http.put<void>(`/messages/${id}/reaction`, { emoji }),
  unreact: (id: number) => http.delete(`/messages/${id}/reaction`),
};

export const uploadsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http.upload<Attachment>("/uploads", form);
  },
};

export const searchApi = {
  search: (q: string, signal?: AbortSignal) => http.get<SearchResult>("/search", { q }, signal),
};
