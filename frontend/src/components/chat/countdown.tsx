"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/format";

interface CountdownProps {
  expiresAt: string;
  /** Called once when the timer hits zero so the message can be hidden before the server purge. */
  onExpire: () => void;
}

/** Ticking disappearing-message badge: ⏱ 4m */
export function Countdown({ expiresAt, onExpire }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Date.parse(expiresAt) - now;
  const expired = remaining <= 0;

  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expired]);

  useEffect(() => {
    if (expired) onExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on the expired transition
  }, [expired]);

  return (
    <span className="inline-flex items-center gap-0.5" title="Disappearing message">
      <Timer size={11} aria-hidden />
      {formatCountdown(remaining)}
    </span>
  );
}
