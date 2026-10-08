"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Splash } from "@/components/auth/auth-gate";
import { useAuthStore } from "@/stores/auth";

/** Entry point: send people where they belong once the stored session has been checked. */
export default function Home() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === "authenticated") router.replace("/chats");
    else if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  return <Splash />;
}
