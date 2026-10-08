"use client";

import { useMemo } from "react";

import { useNameOf } from "@/hooks/use-names";
import type { Reaction } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";

interface ReactionChipsProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  align: "start" | "end";
}

/** Emoji pills under a bubble: one per emoji with a count; yours is highlighted. */
export function ReactionChips({ reactions, onToggle, align }: ReactionChipsProps) {
  const myId = useAuthStore((state) => state.user?.id);
  const nameOf = useNameOf();

  const groups = useMemo(() => {
    const byEmoji = new Map<string, Reaction[]>();
    for (const reaction of reactions) {
      byEmoji.set(reaction.emoji, [...(byEmoji.get(reaction.emoji) ?? []), reaction]);
    }
    return [...byEmoji.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [reactions]);

  if (groups.length === 0) return null;
  return (
    <ul
      className={cn(
        "-mt-2 flex flex-wrap gap-1 px-2",
        align === "end" ? "justify-end" : "justify-start",
      )}
      aria-label="Reactions"
    >
      {groups.map(([emoji, people]) => {
        const mine = people.some((p) => p.user_id === myId);
        const who = people.map((p) =>
          p.user_id === myId ? "You" : (nameOf(p.user_id) ?? "Someone"),
        );
        return (
          <li key={emoji}>
            <button
              type="button"
              onClick={() => onToggle(emoji)}
              title={who.join(", ")}
              aria-label={`${emoji} ${people.length}: ${who.join(", ")}`}
              aria-pressed={mine}
              className={cn(
                "relative flex h-6 items-center gap-1 rounded-full bg-raised px-1.5 text-xs shadow-sm ring-1",
                mine ? "ring-2 ring-bubble-out" : "ring-line",
              )}
            >
              <span className="text-[13px] leading-none">{emoji}</span>
              {people.length > 1 ? (
                <span className="font-medium text-fg-2">{people.length}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
