import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name (also shown as the tooltip). */
  label: string;
  active?: boolean;
  size?: number;
}

export function IconButton({
  label,
  active,
  size = 36,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-fg-2 transition-colors",
        "hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-selected text-fg",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  );
}
