import { describe, expect, it } from "vitest";

import type { Message } from "@/lib/api";
import { systemMessageText } from "@/lib/system-message";

const names: Record<number, string> = { 1: "Alex", 2: "Bob", 3: "Carla" };
const ctx = { myId: 1, nameOf: (id: number) => names[id] };

function system(meta: Record<string, unknown>): Message {
  return {
    id: 1,
    conversation_id: 1,
    sender_id: null,
    client_id: null,
    kind: "system",
    body: null,
    meta,
    reply_to: null,
    attachment: null,
    reactions: [],
    status: null,
    created_at: new Date().toISOString(),
    expires_at: null,
    deleted: false,
  };
}

describe("systemMessageText", () => {
  it("reads naturally from the viewer's perspective", () => {
    expect(
      systemMessageText(system({ event: "added", actor_id: 1, target_ids: [2, 3] }), ctx),
    ).toBe("You added Bob and Carla.");
    expect(systemMessageText(system({ event: "added", actor_id: 2, target_ids: [1] }), ctx)).toBe(
      "Bob added you.",
    );
    expect(systemMessageText(system({ event: "removed", actor_id: 2, target_ids: [3] }), ctx)).toBe(
      "Bob removed Carla.",
    );
    expect(systemMessageText(system({ event: "left", actor_id: 3 }), ctx)).toBe(
      "Carla left the group.",
    );
    expect(
      systemMessageText(system({ event: "promoted", actor_id: 1, target_ids: [2] }), ctx),
    ).toBe("You made Bob an admin.");
  });

  it("handles group info and disappearing timer events", () => {
    expect(systemMessageText(system({ event: "created", actor_id: 1 }), ctx)).toBe(
      "You created the group.",
    );
    expect(systemMessageText(system({ event: "renamed", actor_id: 2, value: "Squad" }), ctx)).toBe(
      "Bob renamed the group to “Squad”.",
    );
    expect(
      systemMessageText(system({ event: "timer_changed", actor_id: 1, seconds: 3600 }), ctx),
    ).toBe("You set the disappearing message time to 1 hour.");
    expect(
      systemMessageText(system({ event: "timer_changed", actor_id: 2, seconds: 0 }), ctx),
    ).toBe("Bob turned off disappearing messages.");
  });

  it("falls back to 'Someone' for unknown users and ignores unknown events", () => {
    expect(systemMessageText(system({ event: "left", actor_id: 99 }), ctx)).toBe(
      "Someone left the group.",
    );
    expect(systemMessageText(system({ event: "mystery" }), ctx)).toBe("");
  });
});
