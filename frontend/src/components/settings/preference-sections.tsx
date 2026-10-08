"use client";

import { Keyboard, LogOut } from "lucide-react";
import { useState } from "react";

import { Toggle } from "@/components/ui/toggle";
import { errorMessage } from "@/lib/actions";
import { usersApi, type UserSettings } from "@/lib/api";
import { requestDesktopNotifications } from "@/lib/notifications";
import { logout } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";

import { SettingRow, SettingsGroup, SoonBadge } from "./setting-row";

export function GeneralSection() {
  const openModal = useUiStore((state) => state.openModal);
  return (
    <>
      <SettingsGroup title="Keyboard">
        <SettingRow
          label="Keyboard shortcuts"
          description="Navigate and send faster without the mouse"
          onClick={() => openModal({ type: "shortcuts" })}
          control={<Keyboard size={18} className="text-fg-3" />}
        />
      </SettingsGroup>
      <SettingsGroup title="Account">
        <SettingRow
          label="Log out"
          description="You'll need to verify your phone number again to sign back in"
          onClick={() => void logout()}
          control={<LogOut size={18} className="text-danger" />}
        />
      </SettingsGroup>
    </>
  );
}

export function ChatsSection() {
  const enterToSend = useUiStore((state) => state.enterToSend);
  const setPreference = useUiStore((state) => state.setPreference);
  return (
    <SettingsGroup title="Composer">
      <SettingRow
        label="Send with Enter"
        description={
          enterToSend
            ? "Enter sends, Shift+Enter adds a new line"
            : "Ctrl+Enter sends, Enter adds a new line"
        }
        control={
          <Toggle
            label="Send with Enter"
            checked={enterToSend}
            onChange={(v) => setPreference("enterToSend", v)}
          />
        }
      />
      <SettingRow
        label="Generate link previews"
        description="Show a preview for links in messages"
        control={<SoonBadge />}
      />
      <SettingRow
        label="Auto-download media"
        description="Download photos and files automatically"
        control={<SoonBadge />}
      />
    </SettingsGroup>
  );
}

export function NotificationsSection() {
  const desktop = useUiStore((state) => state.desktopNotifications);
  const setPreference = useUiStore((state) => state.setPreference);

  async function toggleDesktop(next: boolean) {
    if (next && !(await requestDesktopNotifications())) {
      toast.error("Notifications are blocked. Allow them in your browser's site settings.");
      return;
    }
    setPreference("desktopNotifications", next);
  }

  return (
    <SettingsGroup title="Messages">
      <SettingRow
        label="Desktop notifications"
        description="Show a notification for new messages while this tab is in the background"
        control={
          <Toggle
            label="Desktop notifications"
            checked={desktop}
            onChange={(v) => void toggleDesktop(v)}
          />
        }
      />
      <SettingRow
        label="Notification sounds"
        description="Play a sound for new messages"
        control={<SoonBadge />}
      />
      <SettingRow
        label="Show message content"
        description="Choose what appears in notifications"
        control={<SoonBadge />}
      />
    </SettingsGroup>
  );
}

export function PrivacySection() {
  const user = useAuthStore((state) => state.user);
  const [busy, setBusy] = useState<keyof UserSettings | null>(null);
  if (!user) return null;

  async function change(key: keyof UserSettings, value: boolean) {
    setBusy(key);
    try {
      useAuthStore.getState().setUser(await usersApi.updateMe({ settings: { [key]: value } }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SettingsGroup title="Messaging">
        <SettingRow
          label="Read receipts"
          description="If turned off, you won't send or receive read receipts"
          control={
            <Toggle
              label="Read receipts"
              checked={user.settings.read_receipts}
              disabled={busy === "read_receipts"}
              onChange={(v) => void change("read_receipts", v)}
            />
          }
        />
        <SettingRow
          label="Typing indicators"
          description="If turned off, you won't send or see typing indicators"
          control={
            <Toggle
              label="Typing indicators"
              checked={user.settings.typing_indicators}
              disabled={busy === "typing_indicators"}
              onChange={(v) => void change("typing_indicators", v)}
            />
          }
        />
      </SettingsGroup>
      <SettingsGroup title="Security">
        <SettingRow
          label="Blocked users"
          description="Manage people you've blocked"
          control={<SoonBadge />}
        />
        <SettingRow
          label="Screen lock"
          description="Require a passcode to open Signal"
          control={<SoonBadge />}
        />
        <SettingRow
          label="Default disappearing timer"
          description="Apply a timer to all new chats"
          control={<SoonBadge />}
        />
      </SettingsGroup>
    </>
  );
}
