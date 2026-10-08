"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { errorMessage, openDirectChat } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { COUNTRIES, defaultCountry, joinPhone, matchPhone } from "@/lib/countries";
import { usePeopleStore } from "@/stores/people";
import { useUiStore } from "@/stores/ui";

type Mode = "phone" | "username";

export function AddContactModal() {
  const close = useUiStore((state) => state.closeModal);
  const [mode, setMode] = useState<Mode>("phone");
  const [countryName, setCountryName] = useState(() => defaultCountry().name);
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = COUNTRIES.find((c) => c.name === countryName) ?? COUNTRIES[0];
  const valid =
    mode === "phone" ? phone.replace(/\D/g, "").length >= 6 : username.trim().length >= 3;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const contact = await usePeopleStore.getState().addContact({
        ...(mode === "phone"
          ? { phone: joinPhone(country, phone) }
          : { username: username.trim().replace(/^@/, "") }),
        nickname: nickname.trim() || undefined,
      });
      close();
      useUiStore.getState().pushToast({
        kind: "success",
        message: `${contact.nickname ?? contact.user.display_name} was added to your contacts`,
        actionLabel: "Message",
        onAction: () => void openDirectChat(contact.user.id),
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add contact" onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <div
          role="tablist"
          aria-label="Find by"
          className="grid grid-cols-2 rounded-lg bg-field p-1"
        >
          {(["phone", "username"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                "h-8 rounded-md text-sm font-medium transition-colors",
                mode === value ? "bg-raised shadow-sm" : "text-fg-2 hover:text-fg",
              )}
            >
              {value === "phone" ? "Phone number" : "Username"}
            </button>
          ))}
        </div>

        {mode === "phone" ? (
          <div className="space-y-3">
            <select
              value={countryName}
              onChange={(event) => setCountryName(event.target.value)}
              aria-label="Country"
              className="h-10 w-full rounded-lg bg-field px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dial})
                </option>
              ))}
            </select>
            <div className="flex h-10 items-center rounded-lg bg-field focus-within:ring-2 focus-within:ring-accent">
              <span className="pl-3 text-sm text-fg-2">{country.dial}</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => {
                  const value = event.target.value;
                  const match = value.trim().startsWith("+")
                    ? matchPhone(`+${value.replace(/\D/g, "")}`)
                    : null;
                  if (match) setCountryName(match.country.name);
                  setPhone(match ? match.national : value);
                }}
                maxLength={20}
                placeholder="Phone number"
                aria-label="Phone number"
                data-autofocus
                className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-fg-3"
              />
            </div>
          </div>
        ) : (
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username, e.g. sanyam_w.01"
            aria-label="Username"
            data-autofocus
            className="h-10 w-full rounded-lg bg-field px-3 text-sm outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-accent"
          />
        )}

        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={50}
          placeholder="Nickname (optional)"
          aria-label="Nickname"
          className="h-10 w-full rounded-lg bg-field px-3 text-sm outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-accent"
        />

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid} loading={busy}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}
