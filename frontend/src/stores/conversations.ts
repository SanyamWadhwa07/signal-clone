import { create } from "zustand";

import { conversationsApi, type Conversation, type Message } from "@/lib/api";
import { advanceStatus } from "@/lib/chat";
import { usePeopleStore } from "@/stores/people";

interface ConversationsState {
  byId: Record<number, Conversation>;
  loaded: boolean;

  load: () => Promise<void>;
  /** Fetch one conversation we don't know about yet (e.g. we were just added to a group). */
  fetchOne: (id: number) => Promise<Conversation | null>;
  upsert: (conversation: Conversation) => void;
  remove: (id: number) => void;
  patch: (id: number, patch: Partial<Conversation>) => void;
  /** Reflect a new/updated message in the list row: preview, ordering and unread badge. */
  recordMessage: (message: Message, options: { mine: boolean; viewing: boolean }) => void;
  setLastMessageStatus: (id: number, messageId: number, status: Message["status"]) => void;
  markDeletedPreview: (id: number, messageId: number) => void;
  /** Local read marker; `markRead` also tells the server. */
  applyRead: (id: number, lastReadMessageId: number) => void;
  markRead: (id: number, upToId: number) => Promise<void>;
  reset: () => void;
}

function registerPeers(conversations: Conversation[]) {
  const peers = conversations.flatMap((c) => (c.peer ? [c.peer] : []));
  if (peers.length) usePeopleStore.getState().upsertUsers(peers);
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  byId: {},
  loaded: false,

  load: async () => {
    const list = await conversationsApi.list();
    registerPeers(list);
    set({ byId: Object.fromEntries(list.map((c) => [c.id, c])), loaded: true });
  },

  fetchOne: async (id) => {
    try {
      const conversation = await conversationsApi.get(id);
      get().upsert(conversation);
      return conversation;
    } catch {
      return null;
    }
  },

  upsert: (conversation) => {
    registerPeers([conversation]);
    set((state) => ({ byId: { ...state.byId, [conversation.id]: conversation } }));
  },

  remove: (id) =>
    set((state) => {
      const rest = { ...state.byId };
      delete rest[id];
      return { byId: rest };
    }),

  patch: (id, patch) =>
    set((state) => {
      const current = state.byId[id];
      return current ? { byId: { ...state.byId, [id]: { ...current, ...patch } } } : state;
    }),

  recordMessage: (message, { mine, viewing }) =>
    set((state) => {
      const current = state.byId[message.conversation_id];
      if (!current) return state;
      // Ignore late echoes of messages older than the preview we already show.
      if (current.last_message && message.id < current.last_message.id) return state;
      const countsAsUnread = !mine && !viewing && message.kind !== "system" && !message.deleted;
      const isNewMessage = !current.last_message || message.id > current.last_message.id;
      return {
        byId: {
          ...state.byId,
          [current.id]: {
            ...current,
            last_message: message,
            last_message_at: message.created_at,
            unread_count: current.unread_count + (countsAsUnread && isNewMessage ? 1 : 0),
          },
        },
      };
    }),

  setLastMessageStatus: (id, messageId, status) =>
    set((state) => {
      const current = state.byId[id];
      if (!current?.last_message || current.last_message.id !== messageId || !status) return state;
      const next = advanceStatus(current.last_message.status, status);
      return {
        byId: {
          ...state.byId,
          [id]: {
            ...current,
            last_message: { ...current.last_message, status: next as Message["status"] },
          },
        },
      };
    }),

  markDeletedPreview: (id, messageId) =>
    set((state) => {
      const current = state.byId[id];
      if (!current?.last_message || current.last_message.id !== messageId) return state;
      return {
        byId: {
          ...state.byId,
          [id]: {
            ...current,
            last_message: { ...current.last_message, deleted: true, body: null, attachment: null },
          },
        },
      };
    }),

  applyRead: (id, lastReadMessageId) =>
    set((state) => {
      const current = state.byId[id];
      if (!current || lastReadMessageId < current.last_read_message_id) return state;
      return {
        byId: {
          ...state.byId,
          [id]: { ...current, last_read_message_id: lastReadMessageId, unread_count: 0 },
        },
      };
    }),

  markRead: async (id, upToId) => {
    const current = get().byId[id];
    if (!current || upToId <= current.last_read_message_id) return;
    get().applyRead(id, upToId);
    try {
      await conversationsApi.markRead(id, upToId);
    } catch {
      // Not fatal: the next open or reconnect re-syncs the marker.
    }
  },

  reset: () => set({ byId: {}, loaded: false }),
}));

/** Newest activity first, like Signal's chat list. */
export function sortConversations(byId: Record<number, Conversation>): Conversation[] {
  return Object.values(byId).sort((a, b) => {
    const left =
      Date.parse(b.last_message_at ?? b.created_at) - Date.parse(a.last_message_at ?? a.created_at);
    return left !== 0 ? left : b.id - a.id;
  });
}
