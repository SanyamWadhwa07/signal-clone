import { useMemo } from "react";

import { linkify } from "@/lib/linkify";

/** Message body with safe, clickable links. Built from tokens, never via innerHTML. */
export function MessageText({ text }: { text: string }) {
  const tokens = useMemo(() => linkify(text), [text]);
  return (
    <span className="break-words whitespace-pre-wrap">
      {tokens.map((token, index) =>
        token.type === "link" ? (
          <a
            key={index}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {token.value}
          </a>
        ) : (
          <span key={index}>{token.value}</span>
        ),
      )}
    </span>
  );
}
