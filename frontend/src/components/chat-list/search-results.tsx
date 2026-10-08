"use client";

import { Highlight } from "@/components/ui/highlight";
import { PersonRow } from "@/components/ui/person-row";
import { Spinner } from "@/components/ui/spinner";
import { useNameOf } from "@/hooks/use-names";
import type { SearchResult } from "@/lib/api";
import { openDirectChat } from "@/lib/actions";
import { messageSummary } from "@/lib/chat";
import { formatListTime } from "@/lib/format";
import { chatPath, navigateTo } from "@/lib/navigation";
import { useConversationsStore } from "@/stores/conversations";
import { conversationTitleFor } from "./title";

interface SearchResultsProps {
  query: string;
  result: SearchResult | null;
  loading: boolean;
  /** Number of chats already shown above from the local filter (to decide the empty state). */
  chatMatches: number;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Contacts and message hits from the server, shown under the instantly-filtered chat list. */
export function SearchResults({ query, result, loading, chatMatches }: SearchResultsProps) {
  const nameOf = useNameOf();
  const conversations = useConversationsStore((state) => state.byId);
  const contacts = result?.contacts ?? [];
  const messages = result?.messages ?? [];

  if (loading && !result) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size={20} />
      </div>
    );
  }

  if (!loading && chatMatches === 0 && contacts.length === 0 && messages.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-fg-3">No results for “{query}”</p>;
  }

  return (
    <>
      {contacts.length > 0 ? (
        <Section title="Contacts">
          <div className="px-2">
            {contacts.map(({ id, nickname, user }) => (
              <PersonRow
                key={id}
                name={nickname ?? user.display_name}
                subtitle={user.username ? `@${user.username}` : user.phone}
                color={user.avatar_color}
                avatarUrl={user.avatar_url}
                onClick={() => void openDirectChat(user.id)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {messages.length > 0 ? (
        <Section title="Messages">
          {messages.map(({ message, conversation_id }) => {
            const conversation = conversations[conversation_id];
            const title = conversation ? conversationTitleFor(conversation, nameOf) : "Chat";
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => navigateTo(`${chatPath(conversation_id)}?m=${message.id}`)}
                className="block w-full px-4 py-2.5 text-left hover:bg-hover"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{title}</span>
                  <time className="shrink-0 text-xs text-fg-3" dateTime={message.created_at}>
                    {formatListTime(message.created_at)}
                  </time>
                </span>
                <span className="mt-0.5 line-clamp-2 text-sm text-fg-2">
                  <Highlight text={messageSummary(message)} term={query} />
                </span>
              </button>
            );
          })}
        </Section>
      ) : null}
    </>
  );
}
