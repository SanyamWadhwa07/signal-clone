"use client";

import { Modal } from "@/components/ui/modal";
import { SHORTCUTS } from "@/hooks/use-shortcuts";
import { useUiStore } from "@/stores/ui";

export function ShortcutsModal() {
  const close = useUiStore((state) => state.closeModal);
  return (
    <Modal title="Keyboard shortcuts" onClose={close}>
      <ul className="divide-y divide-line">
        {SHORTCUTS.map(({ keys, action }) => (
          <li key={action} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span>{action}</span>
            <span className="flex shrink-0 gap-1">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="min-w-6 rounded-md border border-line bg-field px-1.5 py-0.5 text-center text-xs font-medium text-fg-2"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
