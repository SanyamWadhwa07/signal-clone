"use client";

import { useCallback, useEffect, useRef } from "react";

import { socket } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";

const RESEND_MS = 3_000;
const IDLE_MS = 5_000;

/**
 * Tells the other members you're typing. Sends "start" on the first keystroke, refreshes it every
 * 3s while you keep typing, and sends "stop" after 5s idle, on send, and when leaving the chat.
 * Respects the "typing indicators" privacy setting (off = nothing is sent).
 */
export function useTypingBroadcast(conversationId: number) {
  const enabled = useAuthStore((state) => state.user?.settings.typing_indicators ?? true);
  const typingRef = useRef(false);
  const lastSentRef = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(
    (isTyping: boolean) =>
      socket.send("typing", { conversation_id: conversationId, is_typing: isTyping }),
    [conversationId],
  );

  const stop = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (typingRef.current) {
      typingRef.current = false;
      send(false);
    }
  }, [send]);

  /** Call on every change of the draft text. */
  const onType = useCallback(
    (text: string) => {
      if (!enabled) return;
      if (text.length === 0) return stop();
      const now = Date.now();
      if (!typingRef.current || now - lastSentRef.current > RESEND_MS) {
        typingRef.current = true;
        lastSentRef.current = now;
        send(true);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stop, IDLE_MS);
    },
    [enabled, send, stop],
  );

  // Leaving the chat (or unmounting) always ends the typing state.
  useEffect(() => stop, [stop]);

  return { onType, stop };
}
