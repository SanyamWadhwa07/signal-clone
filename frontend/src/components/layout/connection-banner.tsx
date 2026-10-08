"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useUiStore } from "@/stores/ui";

/**
 * Signal Desktop's "Connecting…" bar. Delayed by a couple of seconds so quick reconnects and the
 * initial connect don't flash it.
 */
export function ConnectionBanner() {
  const connection = useUiStore((state) => state.connection);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (connection === "open") {
      const reset = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, [connection]);

  if (!visible) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-[#ffd624] px-4 py-1.5 text-xs font-medium text-[#1b1b1b]"
    >
      <WifiOff size={14} aria-hidden />
      {connection === "connecting" ? "Connecting…" : "Disconnected. Trying to reconnect…"}
    </div>
  );
}
