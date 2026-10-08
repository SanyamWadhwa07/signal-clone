import { describe, expect, it } from "vitest";

import type { Conversation, Message } from "@/lib/api";
import { conversationPreview } from "@/lib/preview";

const names: Record<number, string> = { 1: "Alex Rivera", 2: "Bob Chen" };
const ctx = { myId: 1, nameOf: (id: number) => names[id] };

function message(overrides: Partial<Message>): Message {
  return {
    id: 1,
    conversation_id: 1,
    sender_id: 2,
    client_id: null,
    kind: "text",
    body: "hello",
    meta: null,
    reply_to: null,
    attachment: null,
    reactions: [],
    status: null,
    created_at: new Date().toISOString(),
    expires_at: null,
    deleted: false,
    ...overrides,
  };
}

function conversation(type: "direct" | "group", last: Message | null): Conversation {
  return {
    id: 1,
    type,
    name: type === "group" ? "Hikers" : null,
    description: null,
    avatar_url: null,
    avatar_color: null,
    disappearing_seconds: null,
    created_at: new Date().toISOString(),
    last_message_at: null,
    last_message: last,
    unread_count: 0,
    last_read_message_id: 0,
    my_role: "member",
    peer: null,
    member_count: 2,
  };
}

describe("conversationPreview", () => {
  it("prefixes my own messages with 'You:'", () => {
    expect(conversationPreview(conversation("direct", message({ sender_id: 1 })), ctx)).toBe(
      "You: hello",
    );
  });

  it("shows plain text for incoming direct messages", () => {
    expect(conversationPreview(conversation("direct", message({})), ctx)).toBe("hello");
  });

  it("prefixes the sender's first name in groups", () => {
    expect(conversationPreview(conversation("group", message({})), ctx)).toBe("Bob: hello");
  });

  it("renders system messages from my perspective", () => {
    const system = message({
      kind: "system",
      sender_id: null,
      body: null,
      meta: { event: "added", actor_id: 2, target_ids: [1] },
    });
    expect(conversationPreview(conversation("group", system), ctx)).toBe("Bob Chen added you.");
  });

  it("has sensible empty states", () => {
    expect(conversationPreview(conversation("group", null), ctx)).toBe("No messages yet");
    expect(conversationPreview(conversation("direct", null), ctx)).toBe("");
  });
});
