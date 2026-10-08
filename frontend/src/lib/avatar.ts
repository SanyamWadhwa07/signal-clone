/**
 * Signal's named conversation colors. The class names are written out in full so Tailwind
 * can see them at build time (it can't detect dynamically assembled class names).
 */
const COLOR_CLASS: Record<string, string> = {
  crimson: "bg-av-crimson",
  vermilion: "bg-av-vermilion",
  burlap: "bg-av-burlap",
  forest: "bg-av-forest",
  wintergreen: "bg-av-wintergreen",
  teal: "bg-av-teal",
  blue: "bg-av-blue",
  indigo: "bg-av-indigo",
  violet: "bg-av-violet",
  plum: "bg-av-plum",
  taupe: "bg-av-taupe",
  steel: "bg-av-steel",
};

/** Text-color twins of the palette, used for sender names in group chats. */
const TEXT_CLASS: Record<string, string> = {
  crimson: "text-av-crimson",
  vermilion: "text-av-vermilion",
  burlap: "text-av-burlap",
  forest: "text-av-forest",
  wintergreen: "text-av-wintergreen",
  teal: "text-av-teal",
  blue: "text-av-blue",
  indigo: "text-av-indigo",
  violet: "text-av-violet",
  plum: "text-av-plum",
  taupe: "text-av-taupe",
  steel: "text-av-steel",
};

export function avatarTextClass(color: string | null | undefined): string {
  return TEXT_CLASS[color ?? ""] ?? TEXT_CLASS.steel;
}

export function avatarColorClass(color: string | null | undefined): string {
  return COLOR_CLASS[color ?? ""] ?? COLOR_CLASS.steel;
}

/** "Sanyam Wadhwa" -> "SW", "sanyam" -> "S", "+1 555 0100" -> "#" (phone numbers have no initials). */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word));
  if (words.length === 0) return "#";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}
