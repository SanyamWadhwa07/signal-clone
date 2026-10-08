"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { errorMessage } from "@/lib/actions";
import { toast, useUiStore } from "@/stores/ui";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

/** In-app replacement for window.confirm (which blocks the page and can't be themed). */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
}: ConfirmModalProps) {
  const close = useUiStore((state) => state.closeModal);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      close();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-2">{message}</p>
    </Modal>
  );
}
