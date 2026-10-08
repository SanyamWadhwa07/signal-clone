import { calendarDaysAgo } from "@/lib/format";
import type { Conversation, Message, ServerStatus } from "@/lib/api";

/** A message as the UI holds it: server fields plus local-only send states. */
export type LocalStatus = ServerStatus | "sending" | "failed";

export interface ChatMessage extends Omit<Message, "id" | "status"> {
  /** null until the server has assigned an id (optimistic send). */
  id: number | null;
  status: LocalStatus | null;
}

export function toChatMessage(message: Message): ChatMessage {
  return message;
}

/** Stable React key: the client id survives the optimistic -> confirmed transition. */
export function messageKey(message: ChatMessage): string {
  return message.client_id ?? `s-${message.id}`;
}

// ---------------------------------------------------------------- timeline layout

const CLUSTER_WINDOW_MS = 3 * 60_000;

export type TimelineItem =
  | { type: "day"; key: string; iso: string }
  | { type: "unread"; key: string; count: number }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      /** Position inside a run of consecutive bubbles from the same sender. */
      first: boolean;
      last: boolean;
    };

function isBubble(message: ChatMessage): boolean {
  return message.kind !== "system";
}

function continuesRun(previous: ChatMessage, current: ChatMessage): boolean {
  return (
    isBubble(previous) &&
    isBubble(current) &&
    previous.sender_id === current.sender_id &&
    new Date(current.created_at).getTime() - new Date(previous.created_at).getTime() <=
      CLUSTER_WINDOW_MS &&
    calendarDaysAgo(new Date(previous.created_at), new Date(current.created_at)) === 0
  );
}

/**
 * Turns an ordered message list into render items: day dividers, an optional "N unread messages"
 * divider, and bubbles annotated with their position in a same-sender run (drives corner radii,
 * spacing and where avatars / sender names appear in groups).
 */
export function buildTimeline(
  messages: ChatMessage[],
  options: { firstUnreadId?: number | null; unreadCount?: number } = {},
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: ChatMessage | null = null;
  let unreadShown = false;

  messages.forEach((message, index) => {
    const date = new Date(message.created_at);
    if (!previous || calendarDaysAgo(new Date(previous.created_at), date) !== 0) {
      items.push({ type: "day", key: `day-${date.toDateString()}`, iso: message.created_at });
    }
    if (
      !unreadShown &&
      options.firstUnreadId != null &&
      message.id === options.firstUnreadId &&
      (options.unreadCount ?? 0) > 0
    ) {
      items.push({ type: "unread", key: "unread", count: options.unreadCount ?? 0 });
      unreadShown = true;
    }

    const next = messages[index + 1];
    items.push({
      type: "message",
      key: messageKey(message),
      message,
      first: !previous || !continuesRun(previous, message),
      last: !next || !continuesRun(message, next),
    });
    previous = message;
  });
  return items;
}

// ---------------------------------------------------------------- status

const STATUS_RANK: Record<LocalStatus, number> = {
  failed: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

/** Statuses only move forward; a late "sent" event must never undo "read". */
export function advanceStatus(current: LocalStatus | null, next: LocalStatus): LocalStatus {
  if (current === null) return next;
  if (current === "failed" && next !== "failed") return next;
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

// ---------------------------------------------------------------- list preview

export function conversationTitle(conversation: Conversation, myId: number): string {
  if (conversation.type === "group") return conversation.name ?? "Group";
  if (conversation.peer?.id === myId) return "Note to Self";
  return conversation.peer?.display_name ?? "Unknown";
}

/** First line of the chat-list row, without sender prefix: the text or a media label. */
export function messageSummary(message: Message): string {
  if (message.deleted) return "This message was deleted";
  if (message.kind === "attachment" && message.attachment) {
    const label = message.attachment.mime.startsWith("image/")
      ? "📷 Photo"
      : `📎 ${message.attachment.name}`;
    return message.body ? `${label} ${message.body}` : label;
  }
  return (message.body ?? "").replace(/\s+/g, " ");
}
