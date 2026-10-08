import { useSyncExternalStore } from "react";

// Wide layout and a precise pointer: a desktop or laptop, where keyboard shortcuts make sense.
// Phones and tablets (narrow, or touch-first) never show shortcut hints.
const QUERY = "(min-width: 1024px) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True when the device probably has a physical keyboard and keyboard shortcuts are worth showing. */
export function useHasKeyboard(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
