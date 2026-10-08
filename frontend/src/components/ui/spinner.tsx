import { cn } from "@/lib/cn";

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-fg-3/40 border-t-accent",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
