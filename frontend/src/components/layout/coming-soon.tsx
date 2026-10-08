import type { ReactNode } from "react";

import { EmptyPane } from "./empty-state";

interface ComingSoonProps {
  title: string;
  icon: ReactNode;
  description: string;
}

/** Placeholder screens (calls, stories): Signal's two-pane layout with a "Coming soon" body. */
export function ComingSoon({ title, icon, description }: ComingSoonProps) {
  return (
    <>
      <aside className="flex min-h-0 w-full flex-col border-r border-line bg-list lg:w-[340px] lg:shrink-0">
        <header className="flex h-16 shrink-0 items-center px-6">
          <h1 className="text-xl font-semibold">{title}</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-field text-fg-2">
            {icon}
          </span>
          <p className="font-medium">Coming soon</p>
          <p className="text-sm text-fg-3">{description}</p>
        </div>
      </aside>
      <section className="hidden min-w-0 flex-1 lg:flex">
        <EmptyPane title={`${title} are coming soon`}>
          This is a placeholder in the demo. Chats and groups are fully working.
        </EmptyPane>
      </section>
    </>
  );
}
