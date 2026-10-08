import type { Conversation, Message } from "@/lib/api";
import { conversationTitle, messageSummary } from "@/lib/chat";
import { chatPath, navigateTo } from "@/lib/navigation";
import { displayNameFor, usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

/** True when the user is looking at this very conversation (so nothing needs announcing). */
export function isViewing(conversationId: number): boolean {
  return (
    useUiStore.getState().activeChatId === conversationId && document.visibilityState === "visible"
  );
}

/** Ask once, from a user gesture (the settings toggle). Returns whether notifications are on. */
export async function requestDesktopNotifications(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** In-app toast for a message in another chat; a system notification if the tab is hidden. */
export function notifyIncoming(message: Message, conversation: Conversation, myId: number): void {
  const people = usePeopleStore.getState();
  const sender =
    message.sender_id !== null && message.sender_id !== myId
      ? displayNameFor(people, message.sender_id)
      : undefined;
  const title = conversationTitle(conversation, myId);
  const preview = messageSummary(message);
  const text = conversation.type === "group" && sender ? `${sender}: ${preview}` : preview;

  const ui = useUiStore.getState();
  if (document.visibilityState === "hidden") {
    if (
      ui.desktopNotifications &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const notification = new Notification(title, { body: text, tag: `chat-${conversation.id}` });
      notification.onclick = () => {
        window.focus();
        navigateTo(chatPath(conversation.id));
        notification.close();
      };
    }
    return;
  }
  ui.pushToast({
    kind: "info",
    message: `${title}: ${text}`,
    actionLabel: "Open",
    onAction: () => navigateTo(chatPath(conversation.id)),
  });
}
