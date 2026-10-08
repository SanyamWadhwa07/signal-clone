"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SETTINGS_SECTIONS } from "@/components/settings/sections";
import { cn } from "@/lib/cn";

/** Desktop: section list + content. Phone: the list at /settings, each section on its own screen. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inSection = pathname !== "/settings";

  return (
    <>
      <aside
        aria-label="Settings sections"
        className={cn(
          "min-h-0 w-full flex-col border-r border-line bg-list lg:flex lg:w-[330px] lg:shrink-0",
          inSection ? "hidden" : "flex",
        )}
      >
        <header className="flex h-16 shrink-0 items-center px-6">
          <h1 className="text-xl font-semibold">Settings</h1>
        </header>
        <nav className="min-h-0 flex-1 overflow-y-auto pb-4">
          {SETTINGS_SECTIONS.map((section) => {
            const active = pathname === `/settings/${section.slug}`;
            return (
              <Link
                key={section.slug}
                href={`/settings/${section.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-2.5 flex items-center justify-between rounded-xl px-4 py-3 text-base transition-colors",
                  active ? "bg-selected font-medium" : "hover:bg-hover",
                )}
              >
                {section.title}
                <ChevronRight size={16} className="text-fg-3 lg:hidden" aria-hidden />
              </Link>
            );
          })}
        </nav>
      </aside>

      <section
        className={cn("min-w-0 flex-1 flex-col bg-chat lg:flex", inSection ? "flex" : "hidden")}
      >
        <Link
          href="/settings"
          className="flex h-12 shrink-0 items-center gap-1 px-3 text-sm font-medium text-accent lg:hidden"
        >
          <ChevronLeft size={18} aria-hidden /> Settings
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </>
  );
}
