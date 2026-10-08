"use client";

import { Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string;
  onChange: (value: string) => void;
}

/** Rounded gray search input with a clear button, like Signal's chat-list search. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, className, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        "flex h-9 items-center gap-2 rounded-[10px] bg-field px-3 text-fg-2 focus-within:ring-2 focus-within:ring-accent",
        className,
      )}
    >
      <Search size={15} aria-hidden />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="rounded-full p-0.5 hover:text-fg"
        >
          <X size={14} />
        </button>
      ) : null}
    </label>
  );
});
