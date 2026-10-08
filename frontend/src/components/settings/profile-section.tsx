"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/actions";
import { usersApi } from "@/lib/api";
import { prettyPhone } from "@/lib/countries";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";

import { SettingRow, SettingsGroup } from "./setting-row";

export function ProfileSection() {
  const user = useAuthStore((state) => state.user);
  const openModal = useUiStore((state) => state.openModal);
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function saveUsername() {
    setBusy(true);
    setError(null);
    try {
      const updated = await usersApi.updateMe({ username: username.trim() || null });
      useAuthStore.getState().setUser(updated);
      setEditingUsername(false);
      toast.success(updated.username ? `Username set to @${updated.username}` : "Username removed");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Avatar
          name={user.display_name}
          color={user.avatar_color}
          url={user.avatar_url}
          size={72}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold [overflow-wrap:anywhere]">{user.display_name}</p>
          <p className="text-sm text-fg-3">{prettyPhone(user.phone)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => openModal({ type: "edit-profile" })}>
          <Pencil size={14} /> Edit
        </Button>
      </div>

      <SettingsGroup title="About you">
        <SettingRow label="About" description={user.about ?? "Say something about yourself"} />
        <SettingRow label="Phone number" description={prettyPhone(user.phone)} />
      </SettingsGroup>

      <SettingsGroup title="Username">
        {editingUsername ? (
          <div className="space-y-2 px-4 py-3.5">
            <label className="block text-sm font-medium" htmlFor="username">
              Choose a username
            </label>
            <input
              id="username"
              value={username}
              autoFocus
              maxLength={40}
              placeholder="e.g. sanyam_w.01"
              onChange={(event) => setUsername(event.target.value)}
              className="h-10 w-full rounded-lg bg-field px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-fg-3">
              3–32 lowercase letters, numbers or underscores, optionally ending in .NN. People can
              find and message you with it.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingUsername(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={() => void saveUsername()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <SettingRow
            label={user.username ? `@${user.username}` : "Set a username"}
            description="Let people find you without sharing your phone number"
            onClick={() => {
              setUsername(user.username ?? "");
              setEditingUsername(true);
            }}
            control={<Pencil size={16} className="text-fg-3" />}
          />
        )}
      </SettingsGroup>
    </>
  );
}
