import { create } from "zustand";

import { authApi, type AuthResponse, type UserMe } from "@/lib/api";
import { safeGet, safeRemove, safeSet } from "@/lib/safe-storage";

export const TOKEN_KEY = "signal.token";

type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: UserMe | null;
  /** True right after sign-up until the profile (name) step is done. */
  needsProfile: boolean;

  /** Restore the session from storage and verify it with the server. */
  hydrate: () => Promise<void>;
  signIn: (response: AuthResponse) => void;
  setUser: (user: UserMe) => void;
  /** Local-only teardown; use `logout()` / `expireSession()` from lib/session for the full flow. */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  token: null,
  user: null,
  needsProfile: false,

  hydrate: async () => {
    if (get().status !== "loading") return;
    const token = safeGet(TOKEN_KEY);
    if (!token) {
      set({ status: "anonymous" });
      return;
    }
    set({ token });
    try {
      const user = await authApi.me();
      set({ status: "authenticated", user, needsProfile: user.first_name === null });
    } catch (error) {
      // A rejected token is cleared by the global 401 handler; a network error keeps it so the
      // user isn't logged out just because the server is waking up.
      const unauthorized = (error as { status?: number }).status === 401;
      if (unauthorized) {
        safeRemove(TOKEN_KEY);
        set({ status: "anonymous", token: null, user: null });
      } else {
        throw error;
      }
    }
  },

  signIn: ({ token, user, needs_profile }) => {
    safeSet(TOKEN_KEY, token);
    set({ status: "authenticated", token, user, needsProfile: needs_profile });
  },

  setUser: (user) => set({ user, needsProfile: user.first_name === null }),

  clear: () => {
    safeRemove(TOKEN_KEY);
    set({ status: "anonymous", token: null, user: null, needsProfile: false });
  },
}));
