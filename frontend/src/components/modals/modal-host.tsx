"use client";

import { useUiStore } from "@/stores/ui";

import { AddContactModal } from "./add-contact-modal";
import { AddMembersModal } from "./add-members-modal";
import { ConfirmModal } from "./confirm-modal";
import { DisappearingModal } from "./disappearing-modal";
import { EditProfileModal } from "./edit-profile-modal";
import { LightboxModal } from "./lightbox-modal";
import { NewChatModal } from "./new-chat-modal";
import { NewGroupModal } from "./new-group-modal";
import { SafetyNumberModal } from "./safety-number-modal";
import { ShortcutsModal } from "./shortcuts-modal";

/** Renders whichever modal the UI store says is open. One at a time, like Signal. */
export function ModalHost() {
  const modal = useUiStore((state) => state.modal);
  if (!modal) return null;

  switch (modal.type) {
    case "new-chat":
      return <NewChatModal />;
    case "new-group":
      return <NewGroupModal />;
    case "add-contact":
      return <AddContactModal />;
    case "add-members":
      return <AddMembersModal conversationId={modal.conversationId} />;
    case "shortcuts":
      return <ShortcutsModal />;
    case "safety-number":
      return <SafetyNumberModal conversationId={modal.conversationId} />;
    case "disappearing":
      return <DisappearingModal conversationId={modal.conversationId} />;
    case "lightbox":
      return <LightboxModal src={modal.src} name={modal.name} />;
    case "edit-profile":
      return <EditProfileModal />;
    case "confirm":
      return (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          destructive={modal.destructive}
          onConfirm={modal.onConfirm}
        />
      );
  }
}
