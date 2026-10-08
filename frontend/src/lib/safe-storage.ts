import type { StateStorage } from "zustand/middleware";

/** localStorage can throw (private windows, blocked site data); never let that break the app. */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; the app still works for this session.
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const safeStateStorage: StateStorage = {
  getItem: (name) => safeGet(name),
  setItem: (name, value) => safeSet(name, value),
  removeItem: (name) => safeRemove(name),
};
