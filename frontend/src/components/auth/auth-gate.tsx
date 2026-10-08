"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LogoMark } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth";

interface AuthGateProps {
  /** "app": signed in with a finished profile. "guest": signed out. "profile": signed in, profile pending. */
  require: "app" | "guest" | "profile";
  children: ReactNode;
}

/** Route guard + redirect. Renders a splash until the stored session has been checked. */
export function AuthGate({ require, children }: AuthGateProps) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const needsProfile = useAuthStore((state) => state.needsProfile);

  const destination = (() => {
    if (status === "loading") return null;
    if (status === "anonymous") return require === "guest" ? null : "/login";
    if (needsProfile) return require === "profile" ? null : "/onboarding/profile";
    return require === "app" ? null : "/chats";
  })();

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (status === "loading" || destination) return <Splash />;
  return <>{children}</>;
}

export function Splash() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-chat">
      <LogoMark size={72} />
      <Spinner size={22} />
    </div>
  );
}
