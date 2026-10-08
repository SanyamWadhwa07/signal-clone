"use client";

import { Hash, Phone, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { PersonRow } from "@/components/ui/person-row";
import { SearchField } from "@/components/ui/search-field";
import { usersApi } from "@/lib/api";
import { errorMessage, openDirectChat } from "@/lib/actions";
import { prettyPhone } from "@/lib/countries";
import { useAuthStore } from "@/stores/auth";
import { usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

const PHONE_LIKE = /^\+?[\d\s\-().]{6,}$/;
const USERNAME_LIKE = /^@?[a-z0-9_.]{3,}$/i;

function ActionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-selected text-fg-2">
      {children}
    </span>
  );
}

export function NewChatModal() {
  const me = useAuthStore((state) => state.user);
  const contacts = usePeopleStore((state) => state.contacts);
  const addContact = usePeopleStore((state) => state.addContact);
  const openModal = useUiStore((state) => state.openModal);
  const close = useUiStore((state) => state.closeModal);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const term = query.trim();
  const matches = useMemo(() => {
    const needle = term.toLowerCase().replace(/^@/, "");
    if (!needle) return contacts;
    return contacts.filter(({ nickname, user }) =>
      [nickname, user.display_name, user.username, user.phone].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [contacts, term]);

  const isPhone = PHONE_LIKE.test(term);
  const isUsername = !isPhone && USERNAME_LIKE.test(term);

  async function findAndOpen() {
    setBusy(true);
    setError(null);
    try {
      const user = await usersApi.lookup(
        isPhone ? { phone: term } : { username: term.replace(/^@/, "") },
      );
      // Someone you look up and message is a contact from now on, so they appear when you pick
      // group members. Failing to save them must not stop the chat from opening.
      if (user.id !== me?.id && !contacts.some((contact) => contact.user.id === user.id)) {
        await addContact({ phone: user.phone }).catch(() => undefined);
      }
      await openDirectChat(user.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New chat" onClose={close} width="md">
      <SearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          setError(null);
        }}
        placeholder="Search name, username or phone number"
        aria-label="Search contacts"
        data-autofocus
        className="mb-3 h-9"
      />

      {term === "" ? (
        <div className="mb-2">
          <PersonRow
            name="New group"
            leading={
              <ActionIcon>
                <Users size={20} />
              </ActionIcon>
            }
            onClick={() => openModal({ type: "new-group" })}
          />
          <PersonRow
            name="Add contact"
            leading={
              <ActionIcon>
                <UserPlus size={20} />
              </ActionIcon>
            }
            onClick={() => openModal({ type: "add-contact" })}
          />
          {me ? (
            <PersonRow
              name="Note to Self"
              subtitle="Chat with yourself"
              noteToSelf
              onClick={() => void openDirectChat(me.id)}
            />
          ) : null}
        </div>
      ) : null}

      {(isPhone || isUsername) && matches.length === 0 ? (
        <PersonRow
          name={isPhone ? `Find by phone number` : `Find by username`}
          subtitle={isPhone ? term : `@${term.replace(/^@/, "")}`}
          leading={<ActionIcon>{isPhone ? <Phone size={20} /> : <Hash size={20} />}</ActionIcon>}
          onClick={() => void findAndOpen()}
          disabled={busy}
        />
      ) : null}

      {error ? (
        <p role="alert" className="px-2 py-1 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {matches.length > 0 ? (
        <>
          <h3 className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
            Contacts
          </h3>
          {matches.map(({ id, nickname, user }) => (
            <PersonRow
              key={id}
              name={nickname ?? user.display_name}
              subtitle={user.username ? `@${user.username}` : prettyPhone(user.phone)}
              color={user.avatar_color}
              avatarUrl={user.avatar_url}
              onClick={() => void openDirectChat(user.id)}
            />
          ))}
        </>
      ) : term === "" ? (
        <p className="px-2 py-3 text-sm text-fg-3">
          No contacts yet. Add one by phone number or username.
        </p>
      ) : !isPhone && !isUsername ? (
        <p className="px-2 py-3 text-sm text-fg-3">No matches.</p>
      ) : null}
    </Modal>
  );
}
