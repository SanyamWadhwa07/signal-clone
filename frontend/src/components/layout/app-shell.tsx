"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModalHost } from "@/components/modals/modal-host";
import { useRealtimeBootstrap } from "@/hooks/use-realtime-bootstrap";
import { useGlobalShortcuts } from "@/hooks/use-shortcuts";
import { useTitleBadge } from "@/hooks/use-title-badge";

import { MobileTabBar, NavRail } from "./nav-rail";

/** Routes where a phone shows the bottom tab bar (list screens, not an open conversation). */
const TAB_BAR_ROUTES = /^\/(chats|calls|stories|settings)\/?$|^\/settings\/general\/?$/;

export function AppShell({ children }: { children: ReactNode }) {
  useRealtimeBootstrap();
  useGlobalShortcuts();
  useTitleBadge();
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-chat pt-[env(safe-area-inset-top)] lg:flex-row">
      <NavRail />
      <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
      {TAB_BAR_ROUTES.test(pathname) ? <MobileTabBar /> : null}
      <ModalHost />
    </div>
  );
}
