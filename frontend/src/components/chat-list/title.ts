import type { Conversation } from "@/lib/api";
import { conversationTitle } from "@/lib/chat";
import { useAuthStore } from "@/stores/auth";

/** Non-hook variant of useConversationTitle, for rows rendered in loops. */
export function conversationTitleFor(
  conversation: Conversation,
  nameOf: (userId: number) => string | undefined,
): string {
  const myId = useAuthStore.getState().user?.id ?? 0;
  if (conversation.type === "direct" && conversation.peer && conversation.peer.id !== myId) {
    return nameOf(conversation.peer.id) ?? conversationTitle(conversation, myId);
  }
  return conversationTitle(conversation, myId);
}
