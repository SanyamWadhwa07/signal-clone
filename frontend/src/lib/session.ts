import { authApi, configureHttp } from "@/lib/api";
import { SocketClient } from "@/lib/realtime/socket";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { useMessagesStore } from "@/stores/messages";
import { usePeopleStore } from "@/stores/people";
import { usePresenceStore } from "@/stores/presence";
import { toast, useUiStore } from "@/stores/ui";

/** The app's single realtime connection. */
export const socket = new SocketClient(
  () => useAuthStore.getState().token,
  () => expireSession(),
);

/** Drop all per-user state. Preferences (theme, enter-to-send) intentionally survive. */
function teardown(): void {
  socket.disconnect();
  useAuthStore.getState().clear();
  useConversationsStore.getState().reset();
  useMessagesStore.getState().reset();
  usePeopleStore.getState().reset();
  usePresenceStore.getState().reset();
  useUiStore.setState({ activeChatId: null, modal: null, detailsOpen: false, toasts: [] });
}

/** User-initiated logout: revoke the session server-side, then clear everything locally. */
export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // Offline or already expired: local logout still has to work.
  }
  teardown();
}

/** The server rejected our token (expired/revoked). Called by the HTTP layer and the socket. */
export function expireSession(): void {
  if (useAuthStore.getState().status !== "authenticated") return;
  teardown();
  toast.info("Your session has ended. Please log in again.");
}

configureHttp({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: expireSession,
});
