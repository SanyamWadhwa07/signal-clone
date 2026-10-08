import { formatDuration } from "@/lib/format";
import type { Message } from "@/lib/api";

export interface SystemContext {
  myId: number;
  /** Display name for a user id (profile name / nickname); undefined when unknown. */
  nameOf: (userId: number) => string | undefined;
}

function who(userId: number | null | undefined, ctx: SystemContext, capitalize = false): string {
  if (userId === ctx.myId) return capitalize ? "You" : "you";
  return (userId != null ? ctx.nameOf(userId) : undefined) ?? "Someone";
}

function list(ids: number[], ctx: SystemContext): string {
  const names = ids.map((id) => who(id, ctx));
  if (names.length <= 1) return names[0] ?? "someone";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Renders a stored system event from the viewer's perspective. Stored as data (event + ids),
 * not text, so "You added Bob" and "Bob added you" come from the same row.
 */
export function systemMessageText(message: Message, ctx: SystemContext): string {
  const meta = (message.meta ?? {}) as Record<string, unknown>;
  const actorId = (meta.actor_id as number | null | undefined) ?? null;
  const targets = (meta.target_ids as number[] | undefined) ?? [];
  const actor = who(actorId, ctx, true);
  const byMe = actorId === ctx.myId;

  switch (meta.event) {
    case "created":
      return byMe ? "You created the group." : `${actor} created the group.`;
    case "added":
      return `${actor} added ${list(targets, ctx)}.`;
    case "removed":
      return `${actor} removed ${list(targets, ctx)}.`;
    case "left":
      return byMe ? "You left the group." : `${actor} left the group.`;
    case "promoted":
      return `${actor} made ${list(targets, ctx)} ${targets.length > 1 ? "admins" : "an admin"}.`;
    case "demoted":
      return `${actor} removed ${list(targets, ctx)} as admin.`;
    case "renamed":
      return `${actor} renamed the group to “${String(meta.value ?? "")}”.`;
    case "avatar_changed":
      return `${actor} updated the group photo.`;
    case "timer_changed": {
      const seconds = Number(meta.seconds ?? 0);
      return seconds > 0
        ? `${actor} set the disappearing message time to ${formatDuration(seconds)}.`
        : `${actor} turned off disappearing messages.`;
    }
    default:
      return "";
  }
}
