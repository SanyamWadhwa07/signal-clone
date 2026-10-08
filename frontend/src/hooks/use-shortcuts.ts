"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { chatPath } from "@/lib/navigation";
import { useConversationsStore, sortConversations } from "@/stores/conversations";
import { useUiStore } from "@/stores/ui";

export const FOCUS_SEARCH_EVENT = "signal:focus-search";

export interface ShortcutDoc {
  keys: string[];
  action: string;
}

/**
 * Browser-safe equivalents of Signal Desktop's shortcuts (browsers reserve Ctrl+N / Ctrl+Shift+N,
 * so "new chat" lives on Alt+N instead).
 */
export const SHORTCUTS: ShortcutDoc[] = [
  { keys: ["Alt", "N"], action: "New chat" },
  { keys: ["Ctrl", "K"], action: "Search chats" },
  { keys: ["Alt", "↑"], action: "Previous chat" },
  { keys: ["Alt", "↓"], action: "Next chat" },
  { keys: ["Alt", "Shift", "↓"], action: "Next unread chat" },
  { keys: ["Enter"], action: "Send message" },
  { keys: ["Shift", "Enter"], action: "New line" },
  { keys: ["Esc"], action: "Close dialog, cancel reply, or leave chat" },
  { keys: ["Ctrl", "/"], action: "Show keyboard shortcuts" },
];

/** App-wide keyboard shortcuts; mounted once in the signed-in shell. */
export function useGlobalShortcuts(): void {
  const router = useRouter();

  useEffect(() => {
    function stepChat(direction: 1 | -1, unreadOnly: boolean) {
      const ui = useUiStore.getState();
      let list = sortConversations(useConversationsStore.getState().byId);
      if (unreadOnly) list = list.filter((c) => c.unread_count > 0 && c.id !== ui.activeChatId);
      if (list.length === 0) return;
      const index = list.findIndex((c) => c.id === ui.activeChatId);
      const next = unreadOnly ? list[0] : list[(index + direction + list.length) % list.length];
      router.push(chatPath(next.id));
    }

    function onKeyDown(event: KeyboardEvent) {
      const ui = useUiStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "/") {
        event.preventDefault();
        ui.openModal({ type: "shortcuts" });
      } else if (mod && key === "k") {
        event.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      } else if (event.altKey && !mod && key === "n") {
        event.preventDefault();
        ui.openModal({ type: "new-chat" });
      } else if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        stepChat(1, event.shiftKey);
      } else if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        stepChat(-1, false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
