import { useMemo } from "react";
import { create } from "zustand";

const TYPING_TTL_MS = 6_000;

interface PresenceEntry {
  online: boolean;
  lastSeenAt: string | null;
}

interface PresenceState {
  /** Live overrides from "presence" events; falls back to the user's own fields when absent. */
  byUser: Record<number, PresenceEntry>;
  /** conversationId -> userId -> expiry (ms epoch). Entries expire even if "stop" never arrives. */
  typing: Record<number, Record<number, number>>;

  setPresence: (userId: number, online: boolean, lastSeenAt: string | null) => void;
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void;
  reset: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const usePresenceStore = create<PresenceState>((set, get) => ({
  byUser: {},
  typing: {},

  setPresence: (userId, online, lastSeenAt) =>
    set((state) => ({ byUser: { ...state.byUser, [userId]: { online, lastSeenAt } } })),

  setTyping: (conversationId, userId, isTyping) => {
    const key = `${conversationId}:${userId}`;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.delete(key);

    const remove = () =>
      set((state) => {
        const inConversation = { ...(state.typing[conversationId] ?? {}) };
        delete inConversation[userId];
        return { typing: { ...state.typing, [conversationId]: inConversation } };
      });

    if (!isTyping) {
      remove();
      return;
    }
    set((state) => ({
      typing: {
        ...state.typing,
        [conversationId]: {
          ...(state.typing[conversationId] ?? {}),
          [userId]: Date.now() + TYPING_TTL_MS,
        },
      },
    }));
    timers.set(
      key,
      setTimeout(() => get().setTyping(conversationId, userId, false), TYPING_TTL_MS),
    );
  },

  reset: () => {
    timers.forEach(clearTimeout);
    timers.clear();
    set({ byUser: {}, typing: {} });
  },
}));

/** Stable empty list so consumers don't re-render when nobody is typing. */
const NOBODY: number[] = [];

/**
 * Users currently typing in a conversation.
 *
 * The store is subscribed with a selector that returns the store's own (immutably updated) object,
 * and the array is derived with useMemo. A selector that builds a new array on every call makes
 * useSyncExternalStore loop forever ("getSnapshot should be cached").
 */
export function useTypingUserIds(conversationId: number): number[] {
  const entries = usePresenceStore((state) => state.typing[conversationId]);
  return useMemo(() => (entries ? Object.keys(entries).map(Number) : NOBODY), [entries]);
}

/** Primitive selector (boolean), safe to use directly with usePresenceStore. */
export function isAnyoneTyping(state: PresenceState, conversationId: number): boolean {
  const entries = state.typing[conversationId];
  return entries !== undefined && Object.keys(entries).length > 0;
}
