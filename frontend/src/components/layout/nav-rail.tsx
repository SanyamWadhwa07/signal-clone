"use client";

import { Keyboard, LogOut, Menu as MenuIcon, Phone, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { ChatsIcon, StoriesIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { useHasKeyboard } from "@/hooks/use-has-keyboard";
import { cn } from "@/lib/cn";
import { navigateTo } from "@/lib/navigation";
import { logout } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { useUiStore } from "@/stores/ui";

interface Tab {
  href: string;
  label: string;
  match: string;
  icon: (active: boolean) => ReactNode;
}

const TABS: Tab[] = [
  {
    href: "/chats",
    label: "Chats",
    match: "/chats",
    icon: (a) => <ChatsIcon size={26} filled={a} />,
  },
  {
    href: "/calls",
    label: "Calls",
    match: "/calls",
    icon: (a) => <Phone size={25} strokeWidth={a ? 2.2 : 1.6} />,
  },
  {
    href: "/stories",
    label: "Stories",
    match: "/stories",
    icon: (a) => <StoriesIcon size={26} filled={a} strokeWidth={a ? 2 : 1.6} />,
  },
];

function useUnreadTotal(): number {
  return useConversationsStore((state) =>
    Object.values(state.byId).reduce((sum, c) => sum + c.unread_count, 0),
  );
}

/** Signal's red count badge on the Chats tab (the in-list badge is blue). */
function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e51c23] px-1 text-[11px] leading-none font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Desktop: Signal's slim left navigation rail. */
export function NavRail() {
  const pathname = usePathname();
  const unread = useUnreadTotal();
  const user = useAuthStore((state) => state.user);
  const openModal = useUiStore((state) => state.openModal);
  const hasKeyboard = useHasKeyboard();

  return (
    <nav
      aria-label="Main"
      className="hidden w-20 shrink-0 flex-col items-center justify-between border-r border-line bg-rail py-4 lg:flex"
    >
      <div className="flex flex-col items-center gap-3">
        <Menu
          align="left"
          trigger={(props) => (
            <IconButton label="Menu" size={40} className="text-fg" {...props}>
              <MenuIcon size={22} />
            </IconButton>
          )}
          items={[
            {
              label: "Settings",
              icon: <Settings size={16} />,
              onSelect: () => navigateTo("/settings"),
            },
            ...(hasKeyboard
              ? [
                  {
                    label: "Keyboard shortcuts",
                    icon: <Keyboard size={16} />,
                    onSelect: () => openModal({ type: "shortcuts" }),
                  },
                ]
              : []),
            {
              label: "Log out",
              icon: <LogOut size={16} />,
              onSelect: () => void logout(),
              separated: true,
            },
          ]}
        />
        <div className="mt-1 flex flex-col items-center gap-2">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.match);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                title={tab.label}
                className={cn(
                  "flex h-10 w-[60px] items-center justify-center rounded-xl transition-colors",
                  active ? "bg-selected text-fg" : "text-fg hover:bg-hover",
                )}
              >
                <span className="relative flex">
                  {tab.icon(active)}
                  {tab.href === "/chats" ? <Badge count={unread} /> : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className={cn(
            "flex size-10 items-center justify-center rounded-xl transition-colors",
            pathname.startsWith("/settings") ? "bg-selected text-fg" : "text-fg hover:bg-hover",
          )}
        >
          <Settings size={23} strokeWidth={1.6} />
        </Link>
        {user ? (
          <Link href="/settings/profile" aria-label="Your profile" title={user.display_name}>
            <Avatar
              name={user.display_name}
              color={user.avatar_color}
              url={user.avatar_url}
              size={32}
            />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Phone: the same destinations as a bottom tab bar (list screens only). */
export function MobileTabBar() {
  const pathname = usePathname();
  const unread = useUnreadTotal();
  const tabs = [
    ...TABS,
    {
      href: "/settings",
      label: "Settings",
      match: "/settings",
      icon: () => <Settings size={24} strokeWidth={1.6} />,
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="flex h-16 shrink-0 items-center justify-around border-t border-line bg-rail pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.match);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[11px] font-medium",
              active ? "text-accent" : "text-fg-3",
            )}
          >
            <span className="relative flex">
              {tab.icon(active)}
              {tab.href === "/chats" ? <Badge count={unread} /> : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
