"use client";

import { useEffect } from "react";

import { bindRealtime } from "@/lib/realtime/handlers";
import { socket } from "@/lib/session";
import { useConversationsStore } from "@/stores/conversations";
import { usePeopleStore } from "@/stores/people";
import { toast } from "@/stores/ui";

/** Opens the realtime connection and loads the data the signed-in shell needs. */
export function useRealtimeBootstrap(): void {
  useEffect(() => {
    const unbind = bindRealtime(socket);
    socket.connect();

    useConversationsStore
      .getState()
      .load()
      .catch(() => toast.error("Couldn't load your chats. Check your connection."));
    usePeopleStore
      .getState()
      .loadContacts()
      .catch(() => {});

    return () => {
      unbind();
      socket.disconnect();
    };
  }, []);
}
