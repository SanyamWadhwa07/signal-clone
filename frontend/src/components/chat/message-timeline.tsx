"use client";

import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useReadMarker } from "@/hooks/use-read-marker";
import type { Conversation } from "@/lib/api";
import { buildTimeline, type ChatMessage } from "@/lib/chat";
import { chatColorHex } from "@/lib/chat-colors";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore, type Thread } from "@/stores/messages";
import { useTypingUserIds } from "@/stores/presence";
import { toast, useUiStore } from "@/stores/ui";

import { ConversationIntro } from "./conversation-intro";
import { MessageBubble } from "./message-bubble";
import { DayDivider, SystemLine, TypingBubble, UnreadDivider } from "./timeline-extras";

const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_THRESHOLD_PX = 160;
const MAX_JUMP_PAGES = 6;

interface MessageTimelineProps {
  conversation: Conversation;
  thread: Thread;
  onReply: (message: ChatMessage) => void;
  /** Message id to scroll to (from a search hit or a quote click). */
  jumpTo: number | null;
  onJumpDone: () => void;
  onJumpRequest: (messageId: number) => void;
}

export function MessageTimeline({
  conversation,
  thread,
  onReply,
  jumpTo,
  onJumpDone,
  onJumpRequest,
}: MessageTimelineProps) {
  const myId = useAuthStore((state) => state.user?.id);
  const chatColor = useUiStore((state) => state.chatColor);
  const typers = useTypingUserIds(conversation.id);
  const isGroup = conversation.type === "group";
  const isAdmin = conversation.my_role === "admin";

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  // Newest message id the user has actually seen (updated while at the bottom); drives the badge.
  const [seenId, setSeenId] = useState<number | null>(null);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const initialisedRef = useRef(false);
  const lastSeenIdRef = useRef<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const jumpAttemptsRef = useRef(0);

  const { items, hasMore, loadingOlder, status } = thread;

  const newestId = items.at(-1)?.id ?? null;
  if (atBottom && newestId !== null && newestId !== seenId) setSeenId(newestId);
  const newBelow = atBottom
    ? 0
    : items.filter(
        (m) => m.id !== null && m.id > (seenId ?? 0) && m.sender_id !== myId && m.kind !== "system",
      ).length;

  // The "N unread" divider is anchored once, from the read marker the chat had when it opened.
  // undefined = not decided yet; null = nothing unread. Set during render (derived state), not in an effect.
  const [unreadAnchor, setUnreadAnchor] = useState<
    { id: number; count: number } | null | undefined
  >(undefined);
  if (status === "ready" && unreadAnchor === undefined) {
    const first =
      conversation.unread_count > 0
        ? items.find(
            (m) =>
              m.id !== null &&
              m.id > conversation.last_read_message_id &&
              m.sender_id !== myId &&
              m.kind !== "system",
          )
        : undefined;
    setUnreadAnchor(first?.id != null ? { id: first.id, count: conversation.unread_count } : null);
  }

  const timeline = useMemo(
    () =>
      buildTimeline(items, {
        firstUnreadId: unreadAnchor?.id ?? null,
        unreadCount: unreadAnchor?.count ?? 0,
      }),
    [items, unreadAnchor],
  );

  useReadMarker(conversation.id, items, atBottom);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Position after content changes: initial load, new messages, and older pages being prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== "ready") return;

    if (restoreRef.current) {
      // Older messages were added above: keep the viewport where it was.
      el.scrollTop = el.scrollHeight - restoreRef.current.height + restoreRef.current.top;
      restoreRef.current = null;
      return;
    }

    if (!initialisedRef.current) {
      initialisedRef.current = true;
      const divider = el.querySelector<HTMLElement>('[role="separator"]');
      if (divider) divider.scrollIntoView({ block: "start" });
      else scrollToBottom();
      lastSeenIdRef.current = items.at(-1)?.id ?? null;
      return;
    }

    const last = items.at(-1);
    const isNew = last !== undefined && (last.id ?? Infinity) !== lastSeenIdRef.current;
    if (isNew) {
      lastSeenIdRef.current = last.id ?? lastSeenIdRef.current;
      if (atBottomRef.current || last.sender_id === myId) scrollToBottom(true);
    }
  }, [items, status, myId, scrollToBottom]);

  // Typing bubble appearing at the bottom shouldn't hide behind the fold.
  useEffect(() => {
    if (typers.length > 0 && atBottomRef.current) scrollToBottom(true);
  }, [typers.length, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (near !== atBottomRef.current) {
      atBottomRef.current = near;
      setAtBottom(near);
    }

    if (el.scrollTop < LOAD_OLDER_THRESHOLD_PX && hasMore && !loadingOlder) {
      restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
      void useMessagesStore.getState().loadOlder(conversation.id);
    }
  }

  // Anything that changes the height while the user is at the bottom (a reply bar opening above the
  // composer, a reaction chip, an image loading, the typing bubble) must not push the newest message
  // out of view.
  useEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Images change height after load; if the user was at the bottom, stay there.
  function onMediaLoad() {
    if (atBottomRef.current) scrollToBottom();
  }

  // Jump to a message (search hit, quote click): load older pages until it appears.
  useEffect(() => {
    if (jumpTo === null || status !== "ready") return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-mid="${jumpTo}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setHighlightId(jumpTo);
      jumpAttemptsRef.current = 0;
      onJumpDone();
      const timer = setTimeout(() => setHighlightId(null), 1800);
      return () => clearTimeout(timer);
    }
    if (hasMore && jumpAttemptsRef.current < MAX_JUMP_PAGES) {
      if (!loadingOlder) {
        jumpAttemptsRef.current += 1;
        restoreRef.current = null; // we want to land on the target, not keep the old position
        void useMessagesStore.getState().loadOlder(conversation.id);
      }
      return;
    }
    jumpAttemptsRef.current = 0;
    toast.info("That message is no longer available");
    onJumpDone();
  }, [jumpTo, items, status, hasMore, loadingOlder, conversation.id, onJumpDone]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onLoadCapture={onMediaLoad}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        className="@container h-full overflow-x-hidden overflow-y-auto overscroll-contain pb-3"
        style={{ ["--bubble-out" as string]: chatColorHex(chatColor) }}
      >
        <div ref={contentRef}>
          {loadingOlder ? (
            <div className="flex justify-center py-3">
              <Spinner size={18} />
            </div>
          ) : null}
          {!hasMore && status === "ready" ? (
            <ConversationIntro conversation={conversation} />
          ) : null}
          {status === "loading" && items.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : null}
          {status === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-fg-3">
              Couldn&apos;t load messages.
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => void useMessagesStore.getState().loadInitial(conversation.id)}
              >
                Try again
              </button>
            </div>
          ) : null}

          {timeline.map((item) => {
            if (item.type === "day") return <DayDivider key={item.key} iso={item.iso} />;
            if (item.type === "unread") return <UnreadDivider key={item.key} count={item.count} />;
            if (item.message.kind === "system")
              return <SystemLine key={item.key} message={item.message} />;
            return (
              <MessageBubble
                key={item.key}
                message={item.message}
                first={item.first}
                last={item.last}
                isGroup={isGroup}
                isAdmin={isAdmin}
                highlighted={item.message.id !== null && item.message.id === highlightId}
                onReply={onReply}
                onJumpTo={onJumpRequest}
              />
            );
          })}
          <TypingBubble userIds={typers} isGroup={isGroup} />
        </div>
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true);
          }}
          aria-label={newBelow > 0 ? `Scroll to bottom, ${newBelow} new` : "Scroll to bottom"}
          className={cn(
            "absolute right-5 bottom-4 flex size-10 animate-pop-in items-center justify-center rounded-full",
            "bg-raised text-fg shadow-pop ring-1 ring-line hover:bg-hover",
          )}
        >
          <ArrowDown size={20} />
          {newBelow > 0 ? (
            <span className="absolute -top-2 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bubble-out px-1 text-xs font-semibold text-white">
              {newBelow}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
