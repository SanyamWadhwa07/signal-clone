/* eslint-disable @next/next/no-img-element -- avatars are tiny user uploads from another origin */
import { avatarColorClass, initials } from "@/lib/avatar";
import { assetUrl } from "@/lib/config";
import { cn } from "@/lib/cn";

interface AvatarProps {
  name: string;
  color?: string | null;
  url?: string | null;
  size?: number;
  /** Shows Signal's green presence dot when true; omitted entirely when undefined. */
  online?: boolean;
  /** Note to Self uses a lavender disc with a note glyph instead of initials. */
  noteToSelf?: boolean;
  className?: string;
}

export function Avatar({
  name,
  color,
  url,
  size = 40,
  online,
  noteToSelf,
  className,
}: AvatarProps) {
  const src = assetUrl(url);
  const fontSize = Math.max(11, Math.round(size * 0.4));

  return (
    <span
      className={cn("relative inline-flex shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="size-full rounded-full object-cover" draggable={false} />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex size-full items-center justify-center rounded-full font-medium text-white",
            noteToSelf ? "bg-[#ebe1fb] text-[#6a3fc7]" : avatarColorClass(color),
          )}
          style={{ fontSize }}
        >
          {noteToSelf ? <NoteGlyph size={Math.round(size * 0.5)} /> : initials(name)}
        </span>
      )}
      {online ? (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-list bg-online"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
          aria-label="Online"
        />
      ) : null}
    </span>
  );
}

function NoteGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M9 8h6M9 12h6M9 16h6" />
    </svg>
  );
}
