import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/lib/chat";
import {
  firstServerId,
  lastServerId,
  mergeMessage,
  mergePage,
  sortMessages,
} from "@/lib/message-list";

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 1,
    conversation_id: 1,
    sender_id: 1,
    client_id: null,
    kind: "text",
    body: "x",
    meta: null,
    reply_to: null,
    attachment: null,
    reactions: [],
    status: null,
    created_at: "2026-10-08T10:00:00.000Z",
    expires_at: null,
    deleted: false,
    ...overrides,
  };
}

describe("sortMessages", () => {
  it("orders confirmed messages by id and keeps pending ones last, in typing order", () => {
    const sorted = sortMessages([
      msg({ id: null, client_id: "p1" }),
      msg({ id: 7 }),
      msg({ id: null, client_id: "p2" }),
      msg({ id: 3 }),
    ]);
    expect(sorted.map((m) => m.id ?? m.client_id)).toEqual([3, 7, "p1", "p2"]);
  });
});

describe("mergeMessage", () => {
  it("replaces the optimistic copy when the server echo arrives (HTTP response)", () => {
    const optimistic = msg({ id: null, client_id: "c1", status: "sending" });
    const merged = mergeMessage([optimistic], msg({ id: 10, client_id: "c1", status: "sent" }));
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 10, status: "sent" });
  });

  it("does not duplicate when the WebSocket event and HTTP response both arrive", () => {
    const first = mergeMessage([], msg({ id: 10, client_id: "c1", status: "sent" }));
    const second = mergeMessage(first, msg({ id: 10, client_id: "c1", status: "sent" }));
    expect(second).toHaveLength(1);
  });

  it("never lets a stale status overwrite a newer one", () => {
    const current = [msg({ id: 10, client_id: "c1", status: "read" })];
    const merged = mergeMessage(current, msg({ id: 10, client_id: "c1", status: "sent" }));
    expect(merged[0].status).toBe("read");
  });

  it("keeps a known status when the incoming copy has none (recipient view)", () => {
    const current = [msg({ id: 10, status: "delivered" })];
    expect(mergeMessage(current, msg({ id: 10, status: null }))[0].status).toBe("delivered");
  });

  it("inserts new messages in id order", () => {
    const merged = mergeMessage([msg({ id: 1 }), msg({ id: 5 })], msg({ id: 3 }));
    expect(merged.map((m) => m.id)).toEqual([1, 3, 5]);
  });

  it("takes server-side changes such as deletion and new reactions", () => {
    const merged = mergeMessage(
      [msg({ id: 4, body: "hello" })],
      msg({ id: 4, body: null, deleted: true, reactions: [{ user_id: 2, emoji: "👍" }] }),
    );
    expect(merged[0]).toMatchObject({ deleted: true, body: null });
    expect(merged[0].reactions).toHaveLength(1);
  });
});

describe("mergePage and cursors", () => {
  it("prepends an older page and exposes cursors", () => {
    const merged = mergePage([msg({ id: 10 }), msg({ id: 11 })], [msg({ id: 8 }), msg({ id: 9 })]);
    expect(merged.map((m) => m.id)).toEqual([8, 9, 10, 11]);
    expect(firstServerId(merged)).toBe(8);
    expect(lastServerId(merged)).toBe(11);
  });

  it("ignores pending messages when computing cursors", () => {
    const items = [msg({ id: 5 }), msg({ id: null, client_id: "p" })];
    expect(lastServerId(items)).toBe(5);
    expect(lastServerId([msg({ id: null, client_id: "p" })])).toBeNull();
  });
});
