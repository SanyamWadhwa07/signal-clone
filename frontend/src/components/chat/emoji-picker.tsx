"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

import { EMOJI_GROUPS } from "./emoji-data";

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

/** Popover grid of emoji. Closes on outside click or Escape. */
export function EmojiPicker({ onPick, onClose, className }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji picker"
      className={cn(
        "z-30 max-h-72 w-[300px] animate-pop-in overflow-y-auto rounded-xl bg-raised p-2 shadow-pop ring-1 ring-line",
        className,
      )}
    >
      {EMOJI_GROUPS.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="px-1 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">
            {group.label}
          </h3>
          <div className="grid grid-cols-8">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onClick={() => onPick(emoji)}
                className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-hover"
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
