"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Highlight } from "@/components/ui/highlight";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { Spinner } from "@/components/ui/spinner";
import { useServerSearch } from "@/hooks/use-search";
import { useNameOf } from "@/hooks/use-names";
import { messageSummary } from "@/lib/chat";
import { formatListTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";

interface InChatSearchProps {
  conversationId: number;
  onJump: (messageId: number) => void;
  onClose: () => void;
}

/** Search within the open conversation; picking a hit scrolls to and highlights the message. */
export function InChatSearch({ conversationId, onJump, onClose }: InChatSearchProps) {
  const [query, setQuery] = useState("");
  const { result, loading } = useServerSearch(query);
  const nameOf = useNameOf();
  const myId = useAuthStore((state) => state.user?.id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const hits = (result?.messages ?? []).filter((hit) => hit.conversation_id === conversationId);
  const term = query.trim();

  return (
    <div className="border-b border-line bg-chat px-4 py-2">
      <div className="flex items-center gap-2">
        <SearchField
          ref={inputRef}
          value={query}
          onChange={setQuery}
          placeholder="Search in this chat"
          aria-label="Search in this chat"
          className="flex-1"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
            }
          }}
        />
        <IconButton label="Close search" size={32} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>

      {term.length >= 2 ? (
        <div className="mt-2 max-h-64 overflow-y-auto" role="listbox" aria-label="Search results">
          {loading && !result ? (
            <div className="flex justify-center py-3">
              <Spinner size={18} />
            </div>
          ) : hits.length === 0 ? (
            <p className="px-2 py-3 text-sm text-fg-3">No messages found</p>
          ) : (
            hits.map(({ message }) => (
              <button
                key={message.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onJump(message.id)}
                className="block w-full rounded-lg px-2 py-2 text-left hover:bg-hover"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs text-fg-3">
                  <span className="truncate font-medium text-fg-2">
                    {message.sender_id === myId
                      ? "You"
                      : ((message.sender_id && nameOf(message.sender_id)) ?? "Someone")}
                  </span>
                  <time dateTime={message.created_at}>{formatListTime(message.created_at)}</time>
                </span>
                <span className="line-clamp-2 text-sm">
                  <Highlight text={messageSummary(message)} term={term} />
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
