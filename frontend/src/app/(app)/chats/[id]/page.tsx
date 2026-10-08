"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ConversationView } from "@/components/chat/conversation-view";
import { EmptyPane } from "@/components/layout/empty-state";

function ConversationRoute() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = Number(params.id);
  const jump = Number(search.get("m"));

  if (!Number.isInteger(id) || id <= 0) {
    return <EmptyPane title="Chat not found">That conversation doesn&apos;t exist.</EmptyPane>;
  }
  // key = remount per conversation, so reply/search/drafts/scroll state never leak between chats
  return (
    <ConversationView
      key={id}
      conversationId={id}
      initialJump={Number.isInteger(jump) && jump > 0 ? jump : null}
    />
  );
}

export default function ConversationPage() {
  return (
    <Suspense fallback={null}>
      <ConversationRoute />
    </Suspense>
  );
}
