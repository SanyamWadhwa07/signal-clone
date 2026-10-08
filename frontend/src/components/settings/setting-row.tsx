import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title ? (
        <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
          {title}
        </h3>
      ) : null}
      <div className="divide-y divide-line overflow-hidden rounded-xl bg-list ring-1 ring-line">
        {children}
      </div>
    </section>
  );
}

/** One labelled row with an optional description and a control (toggle, button, value) on the right. */
export function SettingRow({
  label,
  description,
  control,
  onClick,
  disabled,
}: {
  label: string;
  description?: string;
  control?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled } : {})}
      className={cn(
        "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left",
        onClick && "hover:bg-hover",
        disabled && "opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-fg-3">{description}</span> : null}
      </span>
      {control}
    </Tag>
  );
}

export function SoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-field px-2.5 py-0.5 text-xs font-medium text-fg-3">
      Coming soon
    </span>
  );
}
