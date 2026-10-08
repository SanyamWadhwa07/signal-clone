"use client";

import { useEffect } from "react";

import { useConversationsStore } from "@/stores/conversations";

/** "(3) Signal" in the browser tab while there are unread messages. */
export function useTitleBadge(): void {
  const unread = useConversationsStore((state) =>
    Object.values(state.byId).reduce((sum, c) => sum + c.unread_count, 0),
  );
  useEffect(() => {
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) Signal` : "Signal";
  }, [unread]);
}
