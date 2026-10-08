import Link from "next/link";

import { LogoMark } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-chat px-6 text-center">
      <LogoMark size={72} />
      <h1 className="text-2xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-fg-3">
        The link may be broken or the page may have moved.
      </p>
      <Link
        href="/chats"
        className="mt-2 inline-flex h-10 items-center rounded-lg bg-bubble-out px-5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Back to chats
      </Link>
    </main>
  );
}
