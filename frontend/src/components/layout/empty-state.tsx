import type { ReactNode } from "react";

import { LogoMark } from "@/components/ui/icons";

/** Right-hand pane when nothing is selected, like Signal Desktop's idle screen. */
export function EmptyPane({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-chat px-8 text-center">
      <LogoMark size={96} className="opacity-90" />
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      {children ? <p className="max-w-sm text-sm text-fg-3">{children}</p> : null}
    </div>
  );
}
