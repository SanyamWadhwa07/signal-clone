"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Toasts } from "@/components/ui/toasts";
import { setNavigator } from "@/lib/navigation";
import { TOKEN_KEY, useAuthStore } from "@/stores/auth";
import { applyTheme, readThemePreference } from "@/lib/theme";
import { expireSession } from "@/lib/session";
import { toast } from "@/stores/ui";

/** App-wide wiring that has no UI of its own: session restore, theme, router bridge, toasts. */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    setNavigator((href) => router.push(href));
  }, [router]);

  // Restore the session once per page load.
  useEffect(() => {
    useAuthStore
      .getState()
      .hydrate()
      .catch(() => {
        // Server unreachable (e.g. free-tier cold start): keep the stored token, let the user retry.
        useAuthStore.setState({ status: "anonymous" });
        toast.error(
          "Can't reach the server right now. It may be waking up; try again in a moment.",
        );
      });
  }, []);

  // Follow the OS theme while the preference is "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePreference() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Logging out in one tab logs out the others.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY && !event.newValue) expireSession();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      {children}
      <Toasts />
    </>
  );
}
