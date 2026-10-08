"use client";

import { Timer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { conversationsApi } from "@/lib/api";
import { errorMessage } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useConversationsStore } from "@/stores/conversations";
import { toast, useUiStore } from "@/stores/ui";

/** Signal's presets, in seconds. 0 = off. Must match the backend allow-list. */
const OPTIONS = [0, 30, 300, 3600, 8 * 3600, 86400, 7 * 86400, 28 * 86400];

export function DisappearingModal({ conversationId }: { conversationId: number }) {
  const close = useUiStore((state) => state.closeModal);
  const conversation = useConversationsStore((state) => state.byId[conversationId]);
  const [value, setValue] = useState(conversation?.disappearing_seconds ?? 0);
  const [busy, setBusy] = useState(false);
  if (!conversation) return null;

  const locked = conversation.type === "group" && conversation.my_role !== "admin";
  const changed = value !== (conversation.disappearing_seconds ?? 0);

  async function save() {
    setBusy(true);
    try {
      const updated = await conversationsApi.update(conversationId, {
        disappearing_seconds: value,
      });
      useConversationsStore.getState().upsert(updated);
      toast.success(
        value
          ? `Messages will disappear after ${formatDuration(value)}`
          : "Disappearing messages are off",
      );
      close();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Disappearing messages"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={locked || !changed} loading={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 flex items-start gap-2 text-sm text-fg-2">
        <Timer size={16} className="mt-0.5 shrink-0" aria-hidden />
        New messages in this chat disappear after the time you choose.
      </p>
      {locked ? (
        <p className="mb-2 text-sm text-fg-3">Only group admins can change this setting.</p>
      ) : null}
      <div role="radiogroup" aria-label="Disappearing message timer">
        {OPTIONS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            role="radio"
            aria-checked={value === seconds}
            disabled={locked}
            onClick={() => setValue(seconds)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-hover disabled:opacity-60"
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border-2",
                value === seconds ? "border-bubble-out" : "border-fg-3",
              )}
            >
              {value === seconds ? <span className="size-2.5 rounded-full bg-bubble-out" /> : null}
            </span>
            {seconds === 0 ? "Off" : formatDuration(seconds)}
          </button>
        ))}
      </div>
    </Modal>
  );
}
