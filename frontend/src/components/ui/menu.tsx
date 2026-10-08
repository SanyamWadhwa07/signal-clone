"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
}

interface MenuProps {
  /** Renders the trigger; spread `props` on the button. */
  trigger: (props: {
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  /** Open upward (used near the bottom of the screen, e.g. attachment menu). */
  up?: boolean;
}

export function Menu({ trigger, items, align = "right", up }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        onClick: () => setOpen((value) => !value),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
      })}
      {open ? (
        <div
          id={id}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-40 min-w-[200px] animate-pop-in rounded-lg bg-raised py-1.5 shadow-pop ring-1 ring-line",
            align === "right" ? "right-0" : "left-0",
            up ? "bottom-full mb-2 origin-bottom" : "top-full mt-1 origin-top",
          )}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separated ? <div className="my-1.5 h-px bg-line" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-hover disabled:opacity-40",
                  item.destructive && "text-danger",
                )}
              >
                {item.icon ? <span className="text-fg-2">{item.icon}</span> : null}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
