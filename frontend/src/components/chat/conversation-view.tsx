"use client";

import { Paperclip } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { ChatMessage } from "@/lib/chat";
import { navigateTo } from "@/lib/navigation";
import { useConversationsStore } from "@/stores/conversations";
import { selectThread, useMessagesStore } from "@/stores/messages";
import { usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

import { Composer, type ComposerHandle } from "./composer";
import { ConversationDetails } from "./conversation-details";
import { ConversationHeader } from "./conversation-header";
import { InChatSearch } from "./in-chat-search";
import { MessageTimeline } from "./message-timeline";

interface ConversationViewProps {
  conversationId: number;
  /** Message to scroll to on open (from `?m=` in a search-result link). */
  initialJump: number | null;
}

/** One open conversation: header, timeline, composer, and the optional details/search panels. */
export function ConversationView({ conversationId, initialJump }: ConversationViewProps) {
  const loaded = useConversationsStore((state) => state.loaded);
  const conversation = useConversationsStore((state) => state.byId[conversationId]);
  const thread = useMessagesStore(selectThread(conversationId));
  const detailsOpen = useUiStore((state) => state.detailsOpen);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpTo, setJumpTo] = useState<number | null>(initialJump);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const composer = useRef<ComposerHandle>(null);

  const isGroup = conversation?.type === "group";

  // Tell the rest of the app which chat is on screen (drives unread/notification decisions).
  useEffect(() => {
    const ui = useUiStore.getState();
    ui.setActiveChat(conversationId);
    ui.setDetailsOpen(false);
    ui.setRevealedMessage(null);
    return () => {
      useUiStore.getState().setActiveChat(null);
      useUiStore.getState().setDetailsOpen(false);
    };
  }, [conversationId]);

  // Fetch history (or catch up if we already hold some) and, for groups, the member list.
  useEffect(() => {
    if (!conversation) return;
    void useMessagesStore.getState().loadInitial(conversationId);
  }, [conversationId, conversation === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isGroup)
      void usePeopleStore
        .getState()
        .loadMembers(conversationId)
        .catch(() => {});
  }, [conversationId, isGroup]);

  // Unknown id: it may be a chat we haven't loaded yet; give up and go back if it truly doesn't exist.
  useEffect(() => {
    if (!loaded || conversation) return;
    let cancelled = false;
    void useConversationsStore
      .getState()
      .fetchOne(conversationId)
      .then((found) => {
        if (!found && !cancelled) navigateTo("/chats");
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, conversation, conversationId]);

  // Escape peels back one layer: details panel, then search, then the chat itself.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const ui = useUiStore.getState();
      if (ui.modal) return;
      if (ui.revealedMessage) ui.setRevealedMessage(null);
      else if (ui.detailsOpen) ui.setDetailsOpen(false);
      else if (searchOpen) setSearchOpen(false);
      else navigateTo("/chats");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-chat">
        <Spinner />
      </div>
    );
  }

  function onDragEnter(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  }
  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) composer.current?.attach(file);
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 bg-chat"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationHeader
          conversation={conversation}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((open) => !open)}
        />
        {searchOpen ? (
          <InChatSearch
            conversationId={conversationId}
            onJump={(id) => {
              setJumpTo(id);
              setSearchOpen(false);
            }}
            onClose={() => setSearchOpen(false)}
          />
        ) : null}
        <MessageTimeline
          conversation={conversation}
          thread={thread}
          onReply={setReplyTo}
          jumpTo={jumpTo}
          onJumpDone={() => setJumpTo(null)}
          onJumpRequest={setJumpTo}
        />
        <Composer
          ref={composer}
          conversationId={conversationId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {detailsOpen ? <ConversationDetails conversation={conversation} /> : null}

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-chat/90 text-accent ring-2 ring-accent ring-inset">
          <Paperclip size={36} />
          <p className="text-lg font-semibold">Drop a file to attach</p>
        </div>
      ) : null}
    </div>
  );
}
