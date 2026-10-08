"use client";

import { useCallback } from "react";

import type { Conversation } from "@/lib/api";
import { conversationTitle } from "@/lib/chat";
import type { SystemContext } from "@/lib/system-message";
import { useAuthStore } from "@/stores/auth";
import { displayNameFor, usePeopleStore } from "@/stores/people";

/** Resolves a user id to the name this viewer should see (nickname > profile name). */
export function useNameOf(): (userId: number) => string | undefined {
  const users = usePeopleStore((state) => state.users);
  const contacts = usePeopleStore((state) => state.contacts);
  // Depending on the data (not the function) re-renders consumers when a name changes.
  return useCallback(
    (userId: number) => displayNameFor({ users, contacts }, userId),
    [users, contacts],
  );
}

export function useSystemContext(): SystemContext | null {
  const myId = useAuthStore((state) => state.user?.id);
  const nameOf = useNameOf();
  return myId === undefined ? null : { myId, nameOf };
}

/** Title shown for a conversation, honouring the viewer's nickname for the other person. */
export function useConversationTitle(conversation: Conversation): string {
  const myId = useAuthStore((state) => state.user?.id ?? 0);
  const nameOf = useNameOf();
  if (conversation.type === "direct" && conversation.peer && conversation.peer.id !== myId) {
    return nameOf(conversation.peer.id) ?? conversationTitle(conversation, myId);
  }
  return conversationTitle(conversation, myId);
}
