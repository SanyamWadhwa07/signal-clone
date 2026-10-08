"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * On desktop /settings jumps straight to the first section; on a phone it stays put so the
 * section list (rendered by the layout) is visible.
 */
export default function SettingsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace("/settings/profile");
  }, [router]);
  return null;
}
