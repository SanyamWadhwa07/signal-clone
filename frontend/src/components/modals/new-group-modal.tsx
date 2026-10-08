"use client";

import { ArrowLeft, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { PersonRow } from "@/components/ui/person-row";
import { SearchField } from "@/components/ui/search-field";
import { createGroup, errorMessage } from "@/lib/actions";
import { avatarColorClass } from "@/lib/avatar";
import { prettyPhone } from "@/lib/countries";
import { chatPath, navigateTo } from "@/lib/navigation";
import { usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

const MAX_OTHER_MEMBERS = 99;

export function NewGroupModal() {
  const contacts = usePeopleStore((state) => state.contacts);
  const close = useUiStore((state) => state.closeModal);
  const openModal = useUiStore((state) => state.openModal);
  const [step, setStep] = useState<"members" | "name">("members");
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byUserId = useMemo(() => new Map(contacts.map((c) => [c.user.id, c])), [contacts]);
  const visible = contacts.filter(({ nickname, user }) =>
    [nickname, user.display_name, user.username, user.phone].some((field) =>
      field?.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );

  function toggle(userId: number) {
    setSelected((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : current.length < MAX_OTHER_MEMBERS
          ? [...current, userId]
          : current,
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup({ name: name.trim(), memberIds: selected });
      close();
      navigateTo(chatPath(group.id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (step === "name") {
    return (
      <Modal
        key="name"
        title="New group"
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep("members")}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button type="submit" form="new-group-form" disabled={!name.trim()} loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <form id="new-group-form" onSubmit={submit} className="flex flex-col items-center">
          <Avatar name={name || "Group"} color="indigo" size={80} />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={32}
            placeholder="Group name (required)"
            aria-label="Group name"
            data-autofocus
            className="mt-5 h-11 w-full rounded-lg bg-field px-3 text-sm outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-accent"
          />
          <p className="mt-3 w-full text-xs text-fg-3">
            {selected.length} {selected.length === 1 ? "member" : "members"} + you. You&apos;ll be
            the admin.
          </p>
          <ul className="mt-2 flex w-full flex-wrap gap-1.5">
            {selected.map((id) => (
              <li key={id} className="rounded-full bg-field px-2.5 py-1 text-xs">
                {byUserId.get(id)?.nickname ?? byUserId.get(id)?.user.display_name}
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="mt-3 w-full text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      key="members"
      title="Add members"
      onClose={close}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0} onClick={() => setStep("name")}>
            Next{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </>
      }
    >
      {selected.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Selected members">
          {selected.map((id) => {
            const contact = byUserId.get(id);
            if (!contact) return null;
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-full bg-field py-1 pr-1 pl-1"
              >
                <span
                  className={`size-5 rounded-full ${avatarColorClass(contact.user.avatar_color)}`}
                />
                <span className="max-w-[110px] truncate text-xs">
                  {contact.nickname ?? contact.user.first_name ?? contact.user.display_name}
                </span>
                <IconButton
                  label={`Remove ${contact.user.display_name}`}
                  size={20}
                  onClick={() => toggle(id)}
                >
                  <X size={12} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search contacts"
        aria-label="Search contacts"
        data-autofocus
        className="mb-2 h-9"
      />

      {contacts.length === 0 ? (
        <div className="px-2 py-4 text-sm text-fg-3">
          You don&apos;t have any contacts yet.{" "}
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => openModal({ type: "add-contact" })}
          >
            Add a contact
          </button>
          .
        </div>
      ) : (
        visible.map(({ id, nickname, user }) => (
          <PersonRow
            key={id}
            name={nickname ?? user.display_name}
            subtitle={user.username ? `@${user.username}` : prettyPhone(user.phone)}
            color={user.avatar_color}
            avatarUrl={user.avatar_url}
            selected={selected.includes(user.id)}
            onClick={() => toggle(user.id)}
          />
        ))
      )}
    </Modal>
  );
}
