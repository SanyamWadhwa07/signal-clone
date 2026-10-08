"use client";

import { Lock } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { useConversationTitle } from "@/hooks/use-names";
import type { Conversation } from "@/lib/api";
import { prettyPhone } from "@/lib/countries";
import { useAuthStore } from "@/stores/auth";

/** Top-of-history header, like Signal's: who this chat is with, shown once all history is loaded. */
export function ConversationIntro({ conversation }: { conversation: Conversation }) {
  const myId = useAuthStore((state) => state.user?.id);
  const title = useConversationTitle(conversation);
  const isGroup = conversation.type === "group";
  const isNote = !isGroup && conversation.peer?.id === myId;

  const subtitle = isGroup
    ? `${conversation.member_count} members`
    : isNote
      ? "Messages you send here are only visible to you."
      : conversation.peer?.username
        ? `@${conversation.peer.username}`
        : conversation.peer
          ? prettyPhone(conversation.peer.phone)
          : "";

  return (
    <div className="flex flex-col items-center px-8 pt-8 pb-4 text-center">
      <Avatar
        name={title}
        color={isGroup ? conversation.avatar_color : conversation.peer?.avatar_color}
        url={isGroup ? conversation.avatar_url : conversation.peer?.avatar_url}
        size={80}
        noteToSelf={isNote}
      />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-sm text-fg-3">{subtitle}</p> : null}
      {!isNote && conversation.peer?.about ? (
        <p className="mt-2 max-w-sm text-sm text-fg-2">{conversation.peer.about}</p>
      ) : null}
      {isGroup && conversation.description ? (
        <p className="mt-2 max-w-sm text-sm text-fg-2">{conversation.description}</p>
      ) : null}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-3">
        <Lock size={12} aria-hidden /> Messages and calls are end-to-end encrypted.
      </p>
    </div>
  );
}
