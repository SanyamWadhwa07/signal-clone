"use client";

import Link from "next/link";
import { memo } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Highlight } from "@/components/ui/highlight";
import { StatusIcon } from "@/components/ui/icons";
import { useConversationTitle, useSystemContext } from "@/hooks/use-names";
import type { Conversation } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatListTime } from "@/lib/format";
import { chatPath } from "@/lib/navigation";
import { conversationPreview } from "@/lib/preview";
import { useAuthStore } from "@/stores/auth";
import { isAnyoneTyping, usePresenceStore } from "@/stores/presence";

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  /** Highlights matches in the title/preview while searching. */
  query?: string;
}

/** One chat-list row: inset rounded card, 48px avatar, two-line preview, badge/status bottom-right. */
function ConversationItemBase({ conversation, selected, query = "" }: ConversationItemProps) {
  const myId = useAuthStore((state) => state.user?.id ?? 0);
  const ctx = useSystemContext();
  const title = useConversationTitle(conversation);
  const typing = usePresenceStore((state) => isAnyoneTyping(state, conversation.id));
  const peerOnline = usePresenceStore((state) =>
    conversation.peer ? state.byUser[conversation.peer.id]?.online : undefined,
  );

  const last = conversation.last_message;
  const unread = conversation.unread_count;
  const isNote = conversation.type === "direct" && conversation.peer?.id === myId;
  const online =
    conversation.type === "direct" && !isNote
      ? (peerOnline ?? conversation.peer?.online)
      : undefined;
  const preview = ctx ? conversationPreview(conversation, ctx) : "";
  const status = last && last.sender_id === myId && unread === 0 ? last.status : null;

  return (
    <Link
      href={chatPath(conversation.id)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "mx-2.5 flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
        selected ? "bg-selected" : "hover:bg-hover",
      )}
    >
      <Avatar
        name={title}
        color={
          conversation.type === "group"
            ? conversation.avatar_color
            : conversation.peer?.avatar_color
        }
        url={
          conversation.type === "group" ? conversation.avatar_url : conversation.peer?.avatar_url
        }
        size={48}
        online={online}
        noteToSelf={isNote}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-base", unread > 0 ? "font-semibold" : "font-medium")}>
            <Highlight text={title} term={query} />
          </span>
          {conversation.last_message_at ? (
            <time
              dateTime={conversation.last_message_at}
              className="shrink-0 text-[13px] text-fg-3"
            >
              {formatListTime(conversation.last_message_at)}
            </time>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-start justify-between gap-2">
          <span
            className={cn(
              "line-clamp-2 text-[15px] leading-snug break-words",
              typing ? "font-medium text-accent" : unread > 0 ? "text-fg" : "text-fg-2",
            )}
          >
            {typing ? "typing…" : <Highlight text={preview} term={query} />}
          </span>
          <span className="flex min-h-5 shrink-0 items-center pt-0.5">
            {unread > 0 ? (
              <span
                aria-label={`${unread} unread`}
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bubble-out px-1.5 text-xs font-semibold text-white"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : status ? (
              <span className="text-fg-3">
                <StatusIcon status={status} size={14} />
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </Link>
  );
}

export const ConversationItem = memo(ConversationItemBase);
