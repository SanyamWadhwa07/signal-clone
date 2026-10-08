import { advanceStatus, type ChatMessage } from "@/lib/chat";

/**
 * Server messages ascending by id, then not-yet-confirmed local messages in the order they were
 * typed. Order never depends on clocks: ids are assigned by the server in arrival order.
 */
export function sortMessages(items: ChatMessage[]): ChatMessage[] {
  const confirmed = items
    .filter((m) => m.id !== null)
    .sort((a, b) => (a.id as number) - (b.id as number));
  const pending = items.filter((m) => m.id === null);
  return [...confirmed, ...pending];
}

function sameMessage(a: ChatMessage, b: ChatMessage): boolean {
  if (a.id !== null && a.id === b.id) return true;
  return a.client_id !== null && a.client_id === b.client_id;
}

/**
 * Insert or update one message. Matches by server id, or by client_id so an optimistic message
 * and its server echo (HTTP response and WebSocket event, in either order) collapse into one.
 * A message's status only moves forward, whichever copy arrives first.
 */
export function mergeMessage(items: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = items.findIndex((existing) => sameMessage(existing, incoming));
  if (index === -1) return sortMessages([...items, incoming]);

  const existing = items[index];
  const status =
    existing.status && incoming.status
      ? advanceStatus(existing.status, incoming.status)
      : (incoming.status ?? existing.status);
  const next = [...items];
  next[index] = { ...incoming, status };
  return sortMessages(next);
}

/** Merge a page of server messages (history or gap fill) into the current list. */
export function mergePage(items: ChatMessage[], page: ChatMessage[]): ChatMessage[] {
  return page.reduce(mergeMessage, items);
}

export function lastServerId(items: ChatMessage[]): number | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const id = items[i].id;
    if (id !== null) return id;
  }
  return null;
}

export function firstServerId(items: ChatMessage[]): number | null {
  return items.find((m) => m.id !== null)?.id ?? null;
}
