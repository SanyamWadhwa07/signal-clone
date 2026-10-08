import {
  ApiError,
  conversationsApi,
  groupsApi,
  messagesApi,
  type Conversation,
  type Member,
} from "@/lib/api";
import type { ChatMessage } from "@/lib/chat";
import { chatPath, navigateTo } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { useMessagesStore } from "@/stores/messages";
import { usePeopleStore } from "@/stores/people";
import { toast, useUiStore } from "@/stores/ui";

/** Human-readable text for any thrown value (API errors already carry a user-facing message). */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Open (creating if needed) the 1:1 chat with a user and navigate to it. */
export async function openDirectChat(userId: number): Promise<void> {
  try {
    const conversation = await conversationsApi.openDirect(userId);
    useConversationsStore.getState().upsert(conversation);
    useUiStore.getState().closeModal();
    navigateTo(chatPath(conversation.id));
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

export async function createGroup(input: {
  name: string;
  memberIds: number[];
  avatarUrl?: string | null;
}): Promise<Conversation> {
  const conversation = await groupsApi.create({
    name: input.name,
    member_ids: input.memberIds,
    avatar_url: input.avatarUrl ?? null,
  });
  useConversationsStore.getState().upsert(conversation);
  return conversation;
}

/**
 * Set/clear my reaction on a message. Optimistic: the chip appears immediately and is rolled
 * back (with a toast) if the server rejects it. Tapping the emoji you already used removes it.
 */
export async function toggleReaction(message: ChatMessage, emoji: string): Promise<void> {
  const me = useAuthStore.getState().user;
  if (!me || message.id === null || message.deleted) return;
  const messages = useMessagesStore.getState();
  const before = message.reactions;
  const mine = before.find((r) => r.user_id === me.id);
  const removing = mine?.emoji === emoji;
  const after = [
    ...before.filter((r) => r.user_id !== me.id),
    ...(removing ? [] : [{ user_id: me.id, emoji }]),
  ];

  messages.applyReactions(message.conversation_id, message.id, after);
  try {
    await (removing ? messagesApi.unreact(message.id) : messagesApi.react(message.id, emoji));
  } catch (error) {
    messages.applyReactions(message.conversation_id, message.id, before);
    toast.error(errorMessage(error));
  }
}

/** Delete for everyone (the server enforces sender/admin and the 24h window). */
export async function deleteMessageForEveryone(message: ChatMessage): Promise<void> {
  if (message.id === null) return;
  await messagesApi.remove(message.id);
  const me = useAuthStore.getState().user;
  useMessagesStore.getState().applyDeleted(message.conversation_id, message.id, me?.id ?? null);
  useConversationsStore.getState().markDeletedPreview(message.conversation_id, message.id);
}

export async function addGroupMembers(
  conversationId: number,
  userIds: number[],
): Promise<Member[]> {
  const members = await groupsApi.addMembers(conversationId, userIds);
  usePeopleStore.getState().setMembers(conversationId, members);
  await useConversationsStore.getState().fetchOne(conversationId);
  return members;
}
