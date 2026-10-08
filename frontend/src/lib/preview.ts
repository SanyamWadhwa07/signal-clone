import type { Conversation } from "@/lib/api";
import { messageSummary } from "@/lib/chat";
import { systemMessageText, type SystemContext } from "@/lib/system-message";

/**
 * The grey second line of a chat-list row, from the viewer's perspective:
 *   "You: see you there"  ·  "Alice: on my way" (groups)  ·  "Bob added you."  ·  "Photo"
 */
export function conversationPreview(conversation: Conversation, ctx: SystemContext): string {
  const message = conversation.last_message;
  if (!message) return conversation.type === "group" ? "No messages yet" : "";
  if (message.kind === "system") return systemMessageText(message, ctx);

  const summary = messageSummary(message);
  if (message.sender_id === ctx.myId) return `You: ${summary}`;
  if (conversation.type === "group" && message.sender_id !== null) {
    const name = ctx.nameOf(message.sender_id)?.split(" ")[0];
    if (name) return `${name}: ${summary}`;
  }
  return summary;
}
