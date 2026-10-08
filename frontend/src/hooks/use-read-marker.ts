"use client";

import { useEffect, useState } from "react";

import type { ChatMessage } from "@/lib/chat";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";

/** True while the browser tab is visible; read receipts must only fire when someone can see the chat. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * Marks the conversation read up to the newest incoming message, but only while the user is at
 * the bottom of the timeline and the tab is visible. The conversations store de-duplicates
 * (it never sends a marker at or below the one it already has).
 */
export function useReadMarker(
  conversationId: number,
  items: ChatMessage[],
  atBottom: boolean,
): void {
  const myId = useAuthStore((state) => state.user?.id);
  const visible = usePageVisible();

  useEffect(() => {
    if (!atBottom || !visible) return;
    for (let i = items.length - 1; i >= 0; i--) {
      const message = items[i];
      if (message.id !== null && message.sender_id !== myId && message.kind !== "system") {
        void useConversationsStore.getState().markRead(conversationId, message.id);
        return;
      }
    }
  }, [conversationId, items, atBottom, visible, myId]);
}
