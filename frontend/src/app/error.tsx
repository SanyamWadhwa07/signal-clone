"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/icons";

/** Route-level error boundary: a calm Signal-style screen instead of a blank page or a stack trace. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-chat px-6 text-center">
      <LogoMark size={72} />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-fg-3">
        An unexpected error occurred. Your messages are safe; try again.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
