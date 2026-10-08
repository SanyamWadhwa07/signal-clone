"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ChatListPane } from "@/components/chat-list/chat-list-pane";
import { cn } from "@/lib/cn";

/**
 * Desktop: chat list + conversation side by side. Phone: one at a time (list at /chats,
 * conversation at /chats/:id), so the same routes work responsively.
 */
export default function ChatsLayout({ children }: { children: ReactNode }) {
  const inConversation = usePathname() !== "/chats";
  return (
    <>
      <ChatListPane className={inConversation ? "hidden lg:flex" : "flex"} />
      <section className={cn("min-w-0 flex-1", inConversation ? "flex" : "hidden lg:flex")}>
        {children}
      </section>
    </>
  );
}
