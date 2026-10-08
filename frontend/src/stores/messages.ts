import { create } from "zustand";

import {
  messagesApi,
  type Attachment,
  type Message,
  type Reaction,
  type SendInput,
} from "@/lib/api";
import { advanceStatus, toChatMessage, type ChatMessage, type LocalStatus } from "@/lib/chat";
import { firstServerId, lastServerId, mergeMessage, mergePage } from "@/lib/message-list";
import { uuid } from "@/lib/uuid";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";

const PAGE_SIZE = 50;

type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface Thread {
  items: ChatMessage[];
  hasMore: boolean;
  status: LoadStatus;
  loadingOlder: boolean;
}

const EMPTY: Thread = { items: [], hasMore: false, status: "idle", loadingOlder: false };

export interface ComposeInput {
  body?: string | null;
  replyTo?: ChatMessage | null;
  attachment?: Attachment | null;
}

interface MessagesState {
  threads: Record<number, Thread>;

  loadInitial: (conversationId: number) => Promise<void>;
  loadOlder: (conversationId: number) => Promise<void>;
  /** Fetch everything newer than what we hold (after a reconnect or while the tab was asleep). */
  gapFill: (conversationId: number) => Promise<void>;
  receive: (message: Message) => void;
  send: (conversationId: number, input: ComposeInput) => Promise<void>;
  retry: (conversationId: number, clientId: string) => Promise<void>;
  discard: (conversationId: number, clientId: string) => void;
  applyStatuses: (
    conversationId: number,
    updates: { id: number; status: "sent" | "delivered" | "read" }[],
  ) => void;
  applyDeleted: (conversationId: number, messageId: number, deletedBy: number | null) => void;
  applyExpired: (conversationId: number, messageIds: number[]) => void;
  applyReactions: (conversationId: number, messageId: number, reactions: Reaction[]) => void;
  removeConversation: (conversationId: number) => void;
  reset: () => void;
}

/** What to resend on retry, keyed by client_id (never needs to survive a reload). */
const outbox = new Map<string, SendInput>();

export const useMessagesStore = create<MessagesState>((set, get) => {
  const thread = (id: number): Thread => get().threads[id] ?? EMPTY;
  const update = (id: number, change: (current: Thread) => Partial<Thread>) =>
    set((state) => {
      const current = state.threads[id] ?? EMPTY;
      return { threads: { ...state.threads, [id]: { ...current, ...change(current) } } };
    });
  const mapItems = (id: number, change: (item: ChatMessage) => ChatMessage) =>
    update(id, (current) => ({ items: current.items.map(change) }));

  async function deliver(conversationId: number, clientId: string): Promise<void> {
    const payload = outbox.get(clientId);
    if (!payload) return;
    setStatus(conversationId, clientId, "sending");
    try {
      const saved = await messagesApi.send(conversationId, payload);
      outbox.delete(clientId);
      update(conversationId, (current) => ({
        items: mergeMessage(current.items, toChatMessage(saved)),
      }));
      useConversationsStore.getState().recordMessage(saved, { mine: true, viewing: true });
    } catch {
      // Network or server error: keep the bubble as "failed" so the user can retry or discard it.
      setStatus(conversationId, clientId, "failed");
    }
  }

  function setStatus(conversationId: number, clientId: string, status: LocalStatus) {
    mapItems(conversationId, (item) =>
      item.client_id === clientId && item.id === null ? { ...item, status } : item,
    );
  }

  return {
    threads: {},

    loadInitial: async (conversationId) => {
      const current = thread(conversationId);
      if (current.status === "ready") {
        await get().gapFill(conversationId);
        return;
      }
      if (current.status === "loading") return;
      update(conversationId, () => ({ status: "loading" }));
      try {
        const page = await messagesApi.list(conversationId, { limit: PAGE_SIZE });
        update(conversationId, (latest) => ({
          items: mergePage(latest.items, page.items.map(toChatMessage)),
          hasMore: page.has_more,
          status: "ready",
        }));
      } catch {
        update(conversationId, () => ({ status: "error" }));
      }
    },

    loadOlder: async (conversationId) => {
      const current = thread(conversationId);
      const before = firstServerId(current.items);
      if (!current.hasMore || current.loadingOlder || before === null) return;
      update(conversationId, () => ({ loadingOlder: true }));
      try {
        const page = await messagesApi.list(conversationId, {
          before_id: before,
          limit: PAGE_SIZE,
        });
        update(conversationId, (latest) => ({
          items: mergePage(latest.items, page.items.map(toChatMessage)),
          hasMore: page.has_more,
          loadingOlder: false,
        }));
      } catch {
        update(conversationId, () => ({ loadingOlder: false }));
      }
    },

    gapFill: async (conversationId) => {
      let cursor = lastServerId(thread(conversationId).items) ?? 0;
      try {
        for (let guard = 0; guard < 20; guard++) {
          const page = await messagesApi.list(conversationId, { after_id: cursor, limit: 100 });
          if (page.items.length === 0) break;
          update(conversationId, (latest) => ({
            items: mergePage(latest.items, page.items.map(toChatMessage)),
          }));
          cursor = page.items[page.items.length - 1].id;
          if (!page.has_more) break;
        }
      } catch {
        // The next reconnect tries again.
      }
    },

    receive: (message) => {
      // Threads we haven't opened load fresh from the server on open; no need to build them here.
      if (thread(message.conversation_id).status !== "ready") return;
      update(message.conversation_id, (current) => ({
        items: mergeMessage(current.items, toChatMessage(message)),
      }));
    },

    send: async (conversationId, { body = null, replyTo = null, attachment = null }) => {
      const me = useAuthStore.getState().user;
      if (!me || (!body && !attachment)) return;
      const clientId = uuid();
      outbox.set(clientId, {
        client_id: clientId,
        body,
        reply_to_id: replyTo?.id ?? null,
        attachment_id: attachment?.id ?? null,
      });
      const optimistic: ChatMessage = {
        id: null,
        conversation_id: conversationId,
        sender_id: me.id,
        client_id: clientId,
        kind: attachment ? "attachment" : "text",
        body,
        meta: null,
        reply_to:
          replyTo && replyTo.id !== null
            ? {
                id: replyTo.id,
                sender_id: replyTo.sender_id,
                kind: replyTo.kind,
                body: replyTo.body,
                attachment: replyTo.attachment,
                deleted: replyTo.deleted,
              }
            : null,
        attachment,
        reactions: [],
        status: "sending",
        created_at: new Date().toISOString(),
        expires_at: null,
        deleted: false,
      };
      update(conversationId, (current) => ({ items: mergeMessage(current.items, optimistic) }));
      await deliver(conversationId, clientId);
    },

    retry: (conversationId, clientId) => deliver(conversationId, clientId),

    discard: (conversationId, clientId) => {
      outbox.delete(clientId);
      update(conversationId, (current) => ({
        items: current.items.filter((m) => !(m.client_id === clientId && m.id === null)),
      }));
    },

    applyStatuses: (conversationId, updates) => {
      const byId = new Map(updates.map((u) => [u.id, u.status]));
      mapItems(conversationId, (item) => {
        const status = item.id !== null ? byId.get(item.id) : undefined;
        return status ? { ...item, status: advanceStatus(item.status, status) } : item;
      });
    },

    applyDeleted: (conversationId, messageId, deletedBy) =>
      mapItems(conversationId, (item) =>
        item.id === messageId
          ? {
              ...item,
              deleted: true,
              body: null,
              attachment: null,
              reactions: [],
              meta:
                deletedBy !== null && deletedBy !== item.sender_id
                  ? { deleted_by: deletedBy }
                  : null,
            }
          : item,
      ),

    applyExpired: (conversationId, messageIds) => {
      const gone = new Set(messageIds);
      update(conversationId, (current) => ({
        items: current.items.filter((m) => m.id === null || !gone.has(m.id)),
      }));
    },

    applyReactions: (conversationId, messageId, reactions) =>
      mapItems(conversationId, (item) => (item.id === messageId ? { ...item, reactions } : item)),

    removeConversation: (conversationId) =>
      set((state) => {
        const rest = { ...state.threads };
        delete rest[conversationId];
        return { threads: rest };
      }),

    reset: () => {
      outbox.clear();
      set({ threads: {} });
    },
  };
});

export function selectThread(conversationId: number) {
  return (state: MessagesState): Thread => state.threads[conversationId] ?? EMPTY;
}
