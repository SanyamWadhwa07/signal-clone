"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui";

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle };

export function Toasts() {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-[460px] animate-pop-in items-center gap-3 rounded-lg bg-[#2e2e2e] py-2.5 pr-2 pl-4 text-sm text-white shadow-pop dark:bg-[#3b3b3b]"
          >
            <Icon
              size={18}
              className={cn(
                "shrink-0",
                toast.kind === "error" ? "text-[#ff8a80]" : "text-[#abc4f8]",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="shrink-0 rounded px-2 py-1 font-medium text-[#abc4f8] hover:bg-white/10"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
