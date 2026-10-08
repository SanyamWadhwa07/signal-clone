import { describe, expect, it } from "vitest";

import type { Message } from "@/lib/api";
import { advanceStatus, buildTimeline, messageSummary, type ChatMessage } from "@/lib/chat";

let nextId = 1;
function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  const id = nextId++;
  return {
    id,
    conversation_id: 1,
    sender_id: 1,
    client_id: `c${id}`,
    kind: "text",
    body: `m${id}`,
    meta: null,
    reply_to: null,
    attachment: null,
    reactions: [],
    status: null,
    created_at: new Date(2026, 9, 8, 10, 0, 0).toISOString(),
    expires_at: null,
    deleted: false,
    ...overrides,
  };
}
const minutes = (m: number, day = 8) => new Date(2026, 9, day, 10, m).toISOString();

describe("buildTimeline", () => {
  it("clusters consecutive messages from one sender within 3 minutes", () => {
    const items = buildTimeline([
      msg({ created_at: minutes(0) }),
      msg({ created_at: minutes(1) }),
      msg({ created_at: minutes(2) }),
    ]).filter((i) => i.type === "message");
    expect(items.map((i) => [i.first, i.last])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
  });

  it("breaks the run on a different sender or a long gap", () => {
    const items = buildTimeline([
      msg({ created_at: minutes(0) }),
      msg({ created_at: minutes(1), sender_id: 2 }),
      msg({ created_at: minutes(10), sender_id: 2 }),
    ]).filter((i) => i.type === "message");
    expect(items.map((i) => [i.first, i.last])).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
  });

  it("inserts a divider per day and keeps system messages out of runs", () => {
    const items = buildTimeline([
      msg({ created_at: minutes(0, 6) }),
      msg({ created_at: minutes(1, 6), kind: "system", sender_id: null }),
      msg({ created_at: minutes(0, 8) }),
    ]);
    expect(items.filter((i) => i.type === "day")).toHaveLength(2);
    const system = items.find((i) => i.type === "message" && i.message.kind === "system");
    expect(system).toMatchObject({ first: true, last: true });
  });

  it("places the unread divider before the first unread message", () => {
    const a = msg({ created_at: minutes(0) });
    const b = msg({ created_at: minutes(5) });
    const items = buildTimeline([a, b], { firstUnreadId: b.id, unreadCount: 1 });
    const types = items.map((i) => i.type);
    expect(types.indexOf("unread")).toBe(types.lastIndexOf("message") - 1);
  });
});

describe("advanceStatus", () => {
  it("only moves forward", () => {
    expect(advanceStatus(null, "sent")).toBe("sent");
    expect(advanceStatus("sending", "sent")).toBe("sent");
    expect(advanceStatus("delivered", "sent")).toBe("delivered");
    expect(advanceStatus("read", "delivered")).toBe("read");
    expect(advanceStatus("sent", "read")).toBe("read");
  });
  it("lets a failed send recover but never regress", () => {
    expect(advanceStatus("failed", "sending")).toBe("sending");
    expect(advanceStatus("sent", "failed")).toBe("sent");
  });
});

describe("messageSummary", () => {
  const base = msg() as Message;
  it("describes media and deleted messages", () => {
    expect(messageSummary({ ...base, deleted: true })).toBe("This message was deleted");
    expect(
      messageSummary({
        ...base,
        kind: "attachment",
        body: null,
        attachment: { id: 1, url: "/u/a.png", name: "a.png", mime: "image/png", size: 1 },
      }),
    ).toBe("📷 Photo");
    expect(
      messageSummary({
        ...base,
        kind: "attachment",
        body: null,
        attachment: { id: 1, url: "/u/a.pdf", name: "cv.pdf", mime: "application/pdf", size: 1 },
      }),
    ).toBe("📎 cv.pdf");
  });
  it("collapses newlines in text previews", () => {
    expect(messageSummary({ ...base, body: "a\n\nb" })).toBe("a b");
  });
});
