import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

interface PersonRowProps {
  name: string;
  subtitle?: string;
  color?: string | null;
  avatarUrl?: string | null;
  noteToSelf?: boolean;
  onClick?: () => void;
  /** When defined, renders Signal's round selection checkbox. */
  selected?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  /** Replaces the avatar, for action rows ("New group", "Add contact"). */
  leading?: ReactNode;
}

export function PersonRow({
  name,
  subtitle,
  color,
  avatarUrl,
  noteToSelf,
  onClick,
  selected,
  disabled,
  trailing,
  leading,
}: PersonRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled } : {})}
      role={selected !== undefined ? "checkbox" : undefined}
      aria-checked={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
        onClick && "hover:bg-hover disabled:opacity-50",
      )}
    >
      {leading ?? (
        <Avatar name={name} color={color} url={avatarUrl} size={40} noteToSelf={noteToSelf} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {subtitle ? <span className="block truncate text-xs text-fg-3">{subtitle}</span> : null}
      </span>
      {trailing}
      {selected !== undefined ? (
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-bubble-out bg-bubble-out text-white" : "border-fg-3",
          )}
        >
          {selected ? <Check size={13} strokeWidth={3} /> : null}
        </span>
      ) : null}
    </Tag>
  );
}
