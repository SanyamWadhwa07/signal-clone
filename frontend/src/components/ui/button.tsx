import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-bubble-out text-white hover:bg-accent-hover disabled:hover:bg-bubble-out",
  secondary: "bg-selected text-fg hover:bg-line",
  destructive: "bg-danger text-white hover:opacity-90",
  ghost: "text-accent hover:bg-hover",
};

const SIZES = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-9 px-5 text-sm",
  lg: "h-11 px-8 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
