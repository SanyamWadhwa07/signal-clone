import type { Conversation, Message, Reaction, UserMe, UserPublic } from "@/lib/api";
import { conversationTitle } from "@/lib/chat";
import { isViewing, notifyIncoming } from "@/lib/notifications";
import type { ServerFrame, SocketClient } from "@/lib/realtime/socket";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { useMessagesStore } from "@/stores/messages";
import { usePeopleStore } from "@/stores/people";
import { usePresenceStore } from "@/stores/presence";
import { toast, useUiStore } from "@/stores/ui";

/** Wire the socket to the stores. Returns an unsubscribe function. */
export function bindRealtime(socket: SocketClient): () => void {
  const offFrames = socket.onFrame(dispatch);
  const offState = socket.onState((state) => useUiStore.getState().setConnection(state));
  return () => {
    offFrames();
    offState();
  };
}

function dispatch(frame: ServerFrame): void {
  const payload = frame.payload as never;
  switch (frame.type) {
    case "ready":
      return void onReady();
    case "message.new":
      return void onMessageNew((payload as { message: Message }).message);
    case "message.status":
      return onStatus(payload);
    case "message.deleted":
      return onDeleted(payload);
    case "message.expired":
      return onExpired(payload);
    case "reaction.updated":
      return onReactions(payload);
    case "typing":
      return onTyping(payload);
    case "presence":
      return onPresence(payload);
    case "user.updated":
      return onUserUpdated(payload as UserPublic);
    case "conversation.updated":
      return onConversationUpdated(payload);
    case "conversation.removed":
      return onConversationRemoved(payload);
    case "conversation.read":
      return onConversationRead(payload);
  }
}

/** (Re)connected: anything that happened while we were away is re-fetched. */
async function onReady(): Promise<void> {
  const conversations = useConversationsStore.getState();
  if (!conversations.loaded) return; // first connect: the app shell does the initial load
  await conversations.load();
  const { threads, gapFill } = useMessagesStore.getState();
  await Promise.all(
    Object.entries(threads)
      .filter(([, thread]) => thread.status === "ready")
      .map(([id]) => gapFill(Number(id))),
  );
}

async function onMessageNew(message: Message): Promise<void> {
  const me = useAuthStore.getState().user;
  if (!me) return;

  const conversations = useConversationsStore.getState();
  let conversation: Conversation | undefined = conversations.byId[message.conversation_id];
  if (!conversation) {
    // A chat we haven't seen: a new DM, or we were just added to a group.
    conversation = (await conversations.fetchOne(message.conversation_id)) ?? undefined;
    if (!conversation) return;
  }

  useMessagesStore.getState().receive(message);

  const mine = message.sender_id === me.id;
  const viewing = isViewing(message.conversation_id);
  useConversationsStore.getState().recordMessage(message, { mine, viewing });

  if (conversation.type === "group") {
    ensureSenderKnown(message);
    // Membership or role changed: refresh the member list and the member count.
    if (message.kind === "system") {
      void usePeopleStore
        .getState()
        .loadMembers(message.conversation_id)
        .catch(() => {});
      void useConversationsStore.getState().fetchOne(message.conversation_id);
    }
  }

  if (mine || message.kind === "system") return;
  if (viewing) {
    void useConversationsStore.getState().markRead(message.conversation_id, message.id);
  } else {
    notifyIncoming(message, conversation, me.id);
  }
}

/** Group messages need the sender's name; load the member list if we've never seen them. */
function ensureSenderKnown(message: Message): void {
  const { users, loadMembers } = usePeopleStore.getState();
  if (message.sender_id !== null && !users[message.sender_id]) {
    void loadMembers(message.conversation_id).catch(() => {});
  }
}

function onStatus(payload: {
  conversation_id: number;
  updates: { id: number; status: "sent" | "delivered" | "read" }[];
}): void {
  useMessagesStore.getState().applyStatuses(payload.conversation_id, payload.updates);
  const conversations = useConversationsStore.getState();
  payload.updates.forEach((u) =>
    conversations.setLastMessageStatus(payload.conversation_id, u.id, u.status),
  );
}

function onDeleted(payload: {
  conversation_id: number;
  message_id: number;
  deleted_by: number;
}): void {
  useMessagesStore
    .getState()
    .applyDeleted(payload.conversation_id, payload.message_id, payload.deleted_by);
  useConversationsStore.getState().markDeletedPreview(payload.conversation_id, payload.message_id);
}

function onExpired(payload: { conversation_id: number; message_ids: number[] }): void {
  useMessagesStore.getState().applyExpired(payload.conversation_id, payload.message_ids);
  // The preview may have been one of the expired messages; ask the server what's latest now.
  void useConversationsStore.getState().fetchOne(payload.conversation_id);
}

function onReactions(payload: {
  conversation_id: number;
  message_id: number;
  reactions: Reaction[];
}): void {
  useMessagesStore
    .getState()
    .applyReactions(payload.conversation_id, payload.message_id, payload.reactions);
}

function onTyping(payload: { conversation_id: number; user_id: number; is_typing: boolean }): void {
  const me = useAuthStore.getState().user;
  if (!me?.settings.typing_indicators) return; // reciprocal: if I hide mine, I don't see theirs
  usePresenceStore
    .getState()
    .setTyping(payload.conversation_id, payload.user_id, payload.is_typing);
}

function onPresence(payload: {
  user_id: number;
  online: boolean;
  last_seen_at: string | null;
}): void {
  usePresenceStore.getState().setPresence(payload.user_id, payload.online, payload.last_seen_at);
}

function onUserUpdated(user: UserPublic): void {
  usePeopleStore.getState().upsertUsers([user]);
  const auth = useAuthStore.getState();
  if (auth.user?.id === user.id) auth.setUser({ ...auth.user, ...user } as UserMe);
  const conversations = useConversationsStore.getState();
  Object.values(conversations.byId)
    .filter((c) => c.peer?.id === user.id)
    .forEach((c) => conversations.patch(c.id, { peer: { ...c.peer, ...user } }));
}

function onConversationUpdated(patch: Partial<Conversation> & { id: number }): void {
  useConversationsStore.getState().patch(patch.id, patch);
}

function onConversationRemoved(payload: {
  conversation_id: number;
  reason: string;
  name: string | null;
}): void {
  const conversations = useConversationsStore.getState();
  const conversation = conversations.byId[payload.conversation_id];
  conversations.remove(payload.conversation_id);
  useMessagesStore.getState().removeConversation(payload.conversation_id);
  if (payload.reason === "removed") {
    const me = useAuthStore.getState().user;
    const title =
      conversation && me ? conversationTitle(conversation, me.id) : (payload.name ?? "the group");
    toast.info(`You were removed from ${title}`);
  }
}

function onConversationRead(payload: {
  conversation_id: number;
  last_read_message_id: number;
}): void {
  // Another device of mine read this chat: clear the badge here too.
  useConversationsStore.getState().applyRead(payload.conversation_id, payload.last_read_message_id);
}
