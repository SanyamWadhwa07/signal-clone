import type { SVGProps } from "react";

import type { LocalStatus } from "@/lib/chat";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

/** The Signal mark: a transparent PNG made from the brand image, drawn at any size. */
export function LogoMark({ size = 64, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden {...rest}>
      <image href="/logo.png" width="64" height="64" />
    </svg>
  );
}

/** Compose / new message: pencil over a square, as in Signal's chat-list header. */
export function ComposeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(props)}>
      <path d="M11 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V13" />
      <path d="m18.2 3.8 2 2a1.4 1.4 0 0 1 0 2L12 16l-3.4.8L9.4 13.4l8.2-8.2a1.4 1.4 0 0 1 .6-.4Z" />
    </svg>
  );
}

/** Chats tab. */
export function ChatsIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(props)}>
      <path
        d="M12 3.5c-4.7 0-8.5 3.3-8.5 7.5 0 2 .9 3.8 2.3 5.2-.3 1-.9 2-1.8 2.8 1.6 0 3-.6 4-1.4 1.2.4 2.6.7 4 .7 4.7 0 8.5-3.3 8.5-7.5S16.700 3.500 12 3.500Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

/** Stories tab: dashed ring, like Signal's story circle. */
export function StoriesIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...base(props)}>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3.2 2.6" />
      <circle cx="12" cy="12" r="3.4" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

/**
 * Message delivery state, drawn like Signal's: dashed ring (sending) → ring with check (sent) →
 * two rings (delivered) → two filled rings (read). `--tick-ink` colors the check on filled rings.
 */
export function StatusIcon({ status, size = 14 }: { status: LocalStatus; size?: number }) {
  const common = {
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.15,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: "img" as const,
  };
  const check = (cx: number, stroke = "currentColor") => (
    <path d={`M${cx - 2.4} 6.3 L${cx - 0.6} 8.1 L${cx + 2.6} 4.2`} stroke={stroke} />
  );

  switch (status) {
    case "sending":
      return (
        <svg viewBox="0 0 12 12" width={size} aria-label="Sending" {...common}>
          <circle cx="6" cy="6" r="5" strokeDasharray="1.9 2.1" />
        </svg>
      );
    case "sent":
      return (
        <svg viewBox="0 0 12 12" width={size} aria-label="Sent" {...common}>
          <circle cx="6" cy="6" r="5" />
          {check(6)}
        </svg>
      );
    case "delivered":
      return (
        <svg viewBox="0 0 17 12" width={(size * 17) / 12} aria-label="Delivered" {...common}>
          <circle cx="6" cy="6" r="5" />
          {check(6)}
          <circle cx="11" cy="6" r="5" />
          {check(11)}
        </svg>
      );
    case "read":
      return (
        <svg viewBox="0 0 17 12" width={(size * 17) / 12} aria-label="Read" {...common}>
          <circle cx="6" cy="6" r="5" fill="currentColor" />
          {check(6, "var(--tick-ink, #2c6bed)")}
          <circle cx="11" cy="6" r="5" fill="currentColor" stroke="var(--tick-ring, transparent)" />
          {check(11, "var(--tick-ink, #2c6bed)")}
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 12 12" width={size} aria-label="Failed to send" {...common}>
          <circle cx="6" cy="6" r="5.4" fill="var(--danger)" stroke="none" />
          <path d="M6 3.2v3.4M6 8.4v.1" stroke="#fff" strokeWidth={1.4} />
        </svg>
      );
  }
}

/** Three bouncing dots used by the typing bubble. */
export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-[6px] animate-typing-dot rounded-full bg-fg-3"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
