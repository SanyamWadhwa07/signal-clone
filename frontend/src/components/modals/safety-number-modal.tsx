"use client";

import { Lock } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useConversationTitle } from "@/hooks/use-names";
import { safetyNumber } from "@/lib/safety-number";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { useUiStore } from "@/stores/ui";

/** Simulated "View safety number": end-to-end encryption is mocked, but the screen is faithful. */
export function SafetyNumberModal({ conversationId }: { conversationId: number }) {
  const close = useUiStore((state) => state.closeModal);
  const me = useAuthStore((state) => state.user);
  const conversation = useConversationsStore((state) => state.byId[conversationId]);
  if (!me || !conversation?.peer) return null;
  return (
    <Content
      meId={me.id}
      peerId={conversation.peer.id}
      onClose={close}
      conversationId={conversationId}
    />
  );
}

function Content({
  meId,
  peerId,
  onClose,
  conversationId,
}: {
  meId: number;
  peerId: number;
  onClose: () => void;
  conversationId: number;
}) {
  const conversation = useConversationsStore((state) => state.byId[conversationId]);
  const title = useConversationTitle(conversation);
  const [verified, setVerified] = useState(false);
  const groups = safetyNumber(meId, peerId);

  return (
    <Modal
      title="Safety number"
      onClose={onClose}
      footer={
        <Button variant={verified ? "secondary" : "primary"} onClick={() => setVerified((v) => !v)}>
          {verified ? "Mark as not verified" : "Mark as verified"}
        </Button>
      }
    >
      <div className="flex flex-col items-center text-center">
        <Avatar
          name={title}
          color={conversation.peer?.avatar_color}
          url={conversation.peer?.avatar_url}
          size={64}
        />
        <p className="mt-3 text-sm text-fg-2">
          Verify end-to-end encryption with <span className="font-medium text-fg">{title}</span> by
          comparing the numbers below with theirs.
        </p>
        <ol
          className="mt-4 grid grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-field px-5 py-4 font-mono text-sm tracking-wider"
          aria-label="Safety number"
        >
          {groups.map((group, index) => (
            <li key={index}>{group}</li>
          ))}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-3">
          <Lock size={12} aria-hidden />
          {verified ? "Verified." : "Not verified."} Encryption in this demo is simulated.
        </p>
      </div>
    </Modal>
  );
}
