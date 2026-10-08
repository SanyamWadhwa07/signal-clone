"use client";

import { Check, Keyboard, LogOut, MoreHorizontal, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConnectionBanner } from "@/components/layout/connection-banner";
import { Avatar } from "@/components/ui/avatar";
import { ComposeIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { SearchField } from "@/components/ui/search-field";
import { Spinner } from "@/components/ui/spinner";
import { FOCUS_SEARCH_EVENT } from "@/hooks/use-shortcuts";
import { useHasKeyboard } from "@/hooks/use-has-keyboard";
import { useNameOf } from "@/hooks/use-names";
import { useServerSearch } from "@/hooks/use-search";
import { cn } from "@/lib/cn";
import { logout } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";
import { sortConversations, useConversationsStore } from "@/stores/conversations";
import { usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

import { ConversationItem } from "./conversation-item";
import { SearchResults } from "./search-results";
import { conversationTitleFor } from "./title";

export function ChatListPane({ className }: { className?: string }) {
  const params = useParams<{ id?: string }>();
  const selectedId = params.id ? Number(params.id) : null;
  const byId = useConversationsStore((state) => state.byId);
  const loaded = useConversationsStore((state) => state.loaded);
  const openModal = useUiStore((state) => state.openModal);
  const hasKeyboard = useHasKeyboard();
  const me = useAuthStore((state) => state.user);
  const nameOf = useNameOf();

  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { result, loading } = useServerSearch(query);

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  const term = query.trim().toLowerCase();
  const conversations = useMemo(() => {
    let list = sortConversations(byId);
    if (unreadOnly) list = list.filter((c) => c.unread_count > 0);
    if (!term) return list;
    return list.filter((c) => {
      const haystack = [conversationTitleFor(c, nameOf), c.peer?.username, c.peer?.phone];
      return haystack.some((value) => value?.toLowerCase().includes(term));
    });
  }, [byId, unreadOnly, term, nameOf]);

  const searching = term.length > 0;

  return (
    <aside
      aria-label="Conversations"
      className={cn(
        "flex min-h-0 w-full flex-col border-r border-line bg-list lg:w-[330px] lg:shrink-0",
        className,
      )}
    >
      <ConnectionBanner />
      <header className="relative flex h-16 shrink-0 items-center justify-between pr-3 pl-4 lg:pl-6">
        {/* Phone: your picture (opens settings) on the left and a centered title, as in Signal mobile. */}
        {me ? (
          <Link href="/settings" aria-label="Settings and profile" className="lg:hidden">
            <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={34} />
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold max-lg:pointer-events-none max-lg:absolute max-lg:inset-x-0 max-lg:text-center max-lg:text-[17px]">
          Chats
        </h1>
        <div className="flex items-center">
          <IconButton label="New chat" onClick={() => openModal({ type: "new-chat" })}>
            <ComposeIcon size={22} />
          </IconButton>
          <Menu
            trigger={(props) => (
              <IconButton label="More" {...props}>
                <MoreHorizontal size={22} />
              </IconButton>
            )}
            items={[
              {
                label: "New group",
                icon: <Users size={16} />,
                onSelect: () => openModal({ type: "new-group" }),
              },
              {
                label: "Add contact",
                icon: <UserPlus size={16} />,
                onSelect: () => openModal({ type: "add-contact" }),
              },
              {
                label: unreadOnly ? "Show all chats" : "Show unread chats only",
                icon: unreadOnly ? <Check size={16} /> : <Check size={16} className="opacity-0" />,
                onSelect: () => setUnreadOnly((value) => !value),
                separated: true,
              },
              ...(hasKeyboard
                ? [
                    {
                      label: "Keyboard shortcuts",
                      icon: <Keyboard size={16} />,
                      onSelect: () => openModal({ type: "shortcuts" }),
                    },
                  ]
                : []),
              { label: "Log out", icon: <LogOut size={16} />, onSelect: () => void logout() },
            ]}
          />
        </div>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <SearchField
          ref={searchRef}
          value={query}
          onChange={setQuery}
          placeholder="Search"
          aria-label="Search chats"
          onKeyDown={(event) => {
            if (event.key === "Escape" && query !== "") {
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        {unreadOnly ? (
          <button
            type="button"
            onClick={() => setUnreadOnly(false)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bubble-out px-3 py-1 text-xs font-medium text-white"
          >
            Unread chats <X size={12} aria-hidden />
            <span className="sr-only">Clear unread filter</span>
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" role="list">
        {!loaded ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            {searching && conversations.length > 0 ? (
              <h3 className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
                Chats
              </h3>
            ) : null}
            {conversations.map((conversation) => (
              <div role="listitem" key={conversation.id}>
                <ConversationItem
                  conversation={conversation}
                  selected={conversation.id === selectedId}
                  query={term}
                />
              </div>
            ))}
            {searching ? (
              <SearchResults
                query={query.trim()}
                result={result}
                loading={loading}
                chatMatches={conversations.length}
              />
            ) : conversations.length === 0 ? (
              <EmptyList
                unreadOnly={unreadOnly}
                onCompose={() => openModal({ type: "new-chat" })}
              />
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function EmptyList({ unreadOnly, onCompose }: { unreadOnly: boolean; onCompose: () => void }) {
  const hasContacts = usePeopleStore((state) => state.contacts.length > 0);
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <p className="font-medium">{unreadOnly ? "No unread chats" : "No chats yet"}</p>
      <p className="mt-1 text-sm text-fg-3">
        {unreadOnly
          ? "You're all caught up."
          : hasContacts
            ? "Pick someone from your contacts to say hello."
            : "Start a conversation with the compose button."}
      </p>
      {!unreadOnly ? (
        <button
          type="button"
          onClick={onCompose}
          className="mt-4 text-sm font-medium text-accent hover:underline"
        >
          Start a new chat
        </button>
      ) : null}
    </div>
  );
}
