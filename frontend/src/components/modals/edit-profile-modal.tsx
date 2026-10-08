"use client";

import { ProfileForm } from "@/components/auth/profile-form";
import { Modal } from "@/components/ui/modal";
import { toast, useUiStore } from "@/stores/ui";

export function EditProfileModal() {
  const close = useUiStore((state) => state.closeModal);
  return (
    <Modal title="Edit profile" onClose={close}>
      <ProfileForm
        submitLabel="Save"
        onDone={() => {
          toast.success("Profile updated");
          close();
        }}
      />
    </Modal>
  );
}
