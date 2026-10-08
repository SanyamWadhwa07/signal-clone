"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PersonRow } from "@/components/ui/person-row";
import { addGroupMembers, errorMessage } from "@/lib/actions";
import { prettyPhone } from "@/lib/countries";
import { usePeopleStore } from "@/stores/people";
import { toast, useUiStore } from "@/stores/ui";

/** Admin-only: add contacts who aren't in the group yet. */
export function AddMembersModal({ conversationId }: { conversationId: number }) {
  const contacts = usePeopleStore((state) => state.contacts);
  const members = usePeopleStore((state) => state.membersByConversation[conversationId]);
  const close = useUiStore((state) => state.closeModal);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = new Set((members ?? []).map((m) => m.user.id));
  const candidates = contacts.filter((c) => !existing.has(c.user.id));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await addGroupMembers(conversationId, selected);
      toast.success(`Added ${selected.length} ${selected.length === 1 ? "member" : "members"}`);
      close();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add members"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0} loading={busy} onClick={() => void submit()}>
            Add{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="py-4 text-sm text-fg-3">All of your contacts are already in this group.</p>
      ) : (
        candidates.map(({ id, nickname, user }) => (
          <PersonRow
            key={id}
            name={nickname ?? user.display_name}
            subtitle={user.username ? `@${user.username}` : prettyPhone(user.phone)}
            color={user.avatar_color}
            avatarUrl={user.avatar_url}
            selected={selected.includes(user.id)}
            onClick={() =>
              setSelected((current) =>
                current.includes(user.id)
                  ? current.filter((x) => x !== user.id)
                  : [...current, user.id],
              )
            }
          />
        ))
      )}
      {error ? (
        <p role="alert" className="pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
