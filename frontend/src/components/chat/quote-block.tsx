"use client";
/* eslint-disable @next/next/no-img-element -- tiny quoted thumbnail from the API origin */

import { useNameOf } from "@/hooks/use-names";
import type { QuotedMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/config";
import { useAuthStore } from "@/stores/auth";

interface QuoteBlockProps {
  quote: QuotedMessage;
  /** Quote inside my own (colored) bubble vs. someone else's. */
  onDark: boolean;
  onJump?: (messageId: number) => void;
  /** Composer preview: no jump, bigger text, dismiss handled by the parent. */
  compact?: boolean;
}

export function quoteText(quote: QuotedMessage): string {
  if (quote.deleted) return "Original message deleted";
  if (quote.attachment) {
    const label = quote.attachment.mime.startsWith("image/") ? "Photo" : quote.attachment.name;
    return quote.body ? `${label}: ${quote.body}` : label;
  }
  return quote.body ?? "";
}

export function QuoteBlock({ quote, onDark, onJump, compact }: QuoteBlockProps) {
  const myId = useAuthStore((state) => state.user?.id);
  const nameOf = useNameOf();
  const author =
    quote.sender_id === myId ? "You" : ((quote.sender_id && nameOf(quote.sender_id)) ?? "Someone");
  const thumb = quote.attachment?.mime.startsWith("image/")
    ? assetUrl(quote.attachment.url)
    : undefined;

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 self-stretch rounded-full",
          onDark ? "bg-white" : "bg-bubble-out",
        )}
      />
      <span className="min-w-0 flex-1 py-1.5 text-left">
        <span className={cn("block truncate text-xs font-semibold", !onDark && "text-accent")}>
          {author}
        </span>
        <span
          className={cn(
            "line-clamp-2 text-[13px] break-words whitespace-pre-wrap",
            quote.deleted && "italic opacity-70",
          )}
        >
          {quoteText(quote)}
        </span>
      </span>
      {thumb ? (
        <img src={thumb} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full min-w-[160px] items-stretch gap-2 overflow-hidden rounded-lg pr-2 pl-0",
    onDark ? "bg-white/20" : "bg-black/[0.06] dark:bg-white/10",
    compact ? "" : "mb-1",
  );

  if (!onJump || compact) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onJump(quote.id)}
      className={cn(className, "cursor-pointer")}
    >
      {content}
    </button>
  );
}
