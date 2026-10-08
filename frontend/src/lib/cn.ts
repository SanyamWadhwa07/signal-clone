import clsx, { type ClassValue } from "clsx";

/** Conditional class names. Components use utility classes only; there is no override merging. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
