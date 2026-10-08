"use client";

import { Timer } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { TypingDots } from "@/components/ui/icons";
import { useSystemContext } from "@/hooks/use-names";
import type { ChatMessage } from "@/lib/chat";
import { formatDayLabel } from "@/lib/format";
import { systemMessageText } from "@/lib/system-message";
import { usePeopleStore } from "@/stores/people";

export function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="text-[13px] font-medium text-fg-3">{formatDayLabel(iso)}</span>
    </div>
  );
}

export function UnreadDivider({ count }: { count: number }) {
  return (
    <div
      role="separator"
      className="my-3 flex items-center gap-3 px-4 text-xs font-medium text-accent"
    >
      <span className="h-px flex-1 bg-accent/40" />
      {count} unread {count === 1 ? "message" : "messages"}
      <span className="h-px flex-1 bg-accent/40" />
    </div>
  );
}

/** Group/timer events: centered plain text from the viewer's perspective ("You added Bob"). */
export function SystemLine({ message }: { message: ChatMessage }) {
  const ctx = useSystemContext();
  const text =
    ctx && message.id !== null
      ? systemMessageText({ ...message, id: message.id, status: null }, ctx)
      : "";
  if (!text) return null;
  const isTimer = message.meta?.event === "timer_changed";
  return (
    <div className="my-4 flex justify-center px-6">
      <p className="flex max-w-[80%] items-center gap-2 text-center text-[15px] text-fg-2">
        {isTimer ? <Timer size={16} className="shrink-0" aria-hidden /> : null}
        {text}
      </p>
    </div>
  );
}

/** Someone is typing: three bouncing dots in an incoming-style bubble (avatars in groups). */
export function TypingBubble({ userIds, isGroup }: { userIds: number[]; isGroup: boolean }) {
  const users = usePeopleStore((state) => state.users);
  if (userIds.length === 0) return null;
  return (
    <div className="mt-2.5 flex items-end gap-2 px-4" role="status" aria-label="Someone is typing">
      {isGroup ? (
        <div className="flex -space-x-2">
          {userIds
            .slice(0, 3)
            .map((id) =>
              users[id] ? (
                <Avatar
                  key={id}
                  name={users[id].display_name}
                  color={users[id].avatar_color}
                  url={users[id].avatar_url}
                  size={28}
                  className="rounded-full ring-2 ring-chat"
                />
              ) : null,
            )}
        </div>
      ) : null}
      <div className="flex h-10 items-center rounded-[20px] bg-bubble-in px-4">
        <TypingDots />
      </div>
    </div>
  );
}
