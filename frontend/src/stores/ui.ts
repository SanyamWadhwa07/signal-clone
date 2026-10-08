import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { ConnectionState } from "@/lib/realtime/socket";
import { safeStateStorage } from "@/lib/safe-storage";
import { uuid } from "@/lib/uuid";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** Optional click target, e.g. open the chat a new-message toast is about. */
  actionLabel?: string;
  onAction?: () => void;
}

export type ModalState =
  | { type: "new-chat" }
  | { type: "new-group" }
  | { type: "add-contact" }
  | { type: "add-members"; conversationId: number }
  | { type: "shortcuts" }
  | { type: "safety-number"; conversationId: number }
  | { type: "disappearing"; conversationId: number }
  | { type: "lightbox"; src: string; name: string }
  | { type: "edit-profile" }
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      destructive?: boolean;
      onConfirm: () => Promise<void> | void;
    };

/** User preferences that survive reloads. */
interface Preferences {
  enterToSend: boolean;
  desktopNotifications: boolean;
  /** Name of one of Signal's chat colors; Ultramarine is the default outgoing bubble. */
  chatColor: string;
}

interface UiState extends Preferences {
  connection: ConnectionState;
  /** Conversation currently open in the main pane, for unread/notification decisions. */
  activeChatId: number | null;
  toasts: Toast[];
  modal: ModalState | null;
  detailsOpen: boolean;
  /** Key of the message whose react/reply/more toolbar is pinned open (tap), or null. */
  revealedMessage: string | null;

  setConnection: (state: ConnectionState) => void;
  setActiveChat: (id: number | null) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  pushToast: (toast: Omit<Toast, "id">, durationMs?: number) => string;
  dismissToast: (id: string) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  setDetailsOpen: (open: boolean) => void;
  setRevealedMessage: (key: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      enterToSend: true,
      desktopNotifications: false,
      chatColor: "ultramarine",

      connection: "closed",
      activeChatId: null,
      toasts: [],
      modal: null,
      detailsOpen: false,
      revealedMessage: null,

      setConnection: (connection) => set({ connection }),
      setActiveChat: (activeChatId) => set({ activeChatId }),
      setPreference: (key, value) => set({ [key]: value } as Pick<Preferences, typeof key>),

      pushToast: (toast, durationMs = 4500) => {
        const id = uuid();
        // Keep the stack short: the oldest toast makes room for the newest.
        set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }));
        if (durationMs > 0) setTimeout(() => get().dismissToast(id), durationMs);
        return id;
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),
      setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
      setRevealedMessage: (revealedMessage) => set({ revealedMessage }),
    }),
    {
      name: "signal.preferences",
      storage: createJSONStorage(() => safeStateStorage),
      partialize: ({ enterToSend, desktopNotifications, chatColor }) => ({
        enterToSend,
        desktopNotifications,
        chatColor,
      }),
    },
  ),
);

/** Convenience for non-component code. */
export const toast = {
  info: (message: string) => useUiStore.getState().pushToast({ kind: "info", message }),
  success: (message: string) => useUiStore.getState().pushToast({ kind: "success", message }),
  error: (message: string) => useUiStore.getState().pushToast({ kind: "error", message }, 6000),
};
