"use client";

import { Camera } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ApiError, uploadsApi, usersApi } from "@/lib/api";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { cleanFirstName, isValidFirstName, splitFullName } from "@/lib/names";
import { useAuthStore } from "@/stores/auth";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Display name, photo and about. Used for onboarding and, later, for editing the profile. */
export function ProfileForm({
  onDone,
  submitLabel = "Finish",
}: {
  onDone?: () => void;
  submitLabel?: string;
}) {
  const user = useAuthStore((state) => state.user);
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [about, setAbout] = useState(user?.about ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastNameInput = useRef<HTMLInputElement>(null);

  if (!user) return null;
  const fullName = `${firstName} ${lastName}`.trim() || user.phone;

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setError("Choose a PNG, JPEG, GIF or WebP image.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("That image is larger than 10 MB.");
    setError(null);
    setUploading(true);
    try {
      setAvatarUrl((await uploadsApi.upload(file)).url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  /**
   * First name is one word. Typing a space moves on to the surname field, and a pasted full name
   * ("Sanyam Wadhwa") is split between the two fields instead of being rejected.
   */
  function onFirstNameChange(raw: string) {
    if (!/\s/.test(raw)) return setFirstName(cleanFirstName(raw));
    const { first, rest } = splitFullName(raw);
    setFirstName(first);
    if (rest && !lastName.trim()) setLastName(rest.slice(0, 26));
    lastNameInput.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidFirstName(firstName.trim()) || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await usersApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        about: about.trim() || null,
        avatar_url: avatarUrl,
      });
      useAuthStore.getState().setUser(updated);
      onDone?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center">
      <div className="relative">
        <Avatar name={fullName} color={user.avatar_color} url={avatarUrl} size={96} />
        <button
          type="button"
          aria-label="Change profile photo"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-bubble-out text-white shadow ring-2 ring-chat hover:bg-accent-hover disabled:opacity-60"
        >
          <Camera size={16} />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          hidden
          onChange={(event) => {
            void chooseFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {avatarUrl ? (
        <button
          type="button"
          onClick={() => setAvatarUrl(null)}
          className="mt-2 text-xs text-accent hover:underline"
        >
          Remove photo
        </button>
      ) : null}

      <div className="mt-6 w-full space-y-3 text-left">
        <Field label="First name" required>
          <input
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                lastNameInput.current?.focus();
              }
            }}
            maxLength={26}
            autoComplete="given-name"
            autoFocus
            data-autofocus
            className="h-11 w-full rounded-lg bg-field px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </Field>
        <p className="-mt-1 text-xs text-fg-3">
          One word only. Your surname goes in the next field.
        </p>
        <Field label="Last name (optional)">
          <input
            ref={lastNameInput}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={26}
            autoComplete="family-name"
            className="h-11 w-full rounded-lg bg-field px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </Field>
        <Field label="About">
          <input
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            maxLength={140}
            placeholder="Say something about yourself"
            className="h-11 w-full rounded-lg bg-field px-3 text-sm outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-accent"
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="mt-3 w-full text-left text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={!isValidFirstName(firstName.trim()) || uploading}
        loading={saving}
      >
        {submitLabel}
      </Button>
      <p className="mt-3 text-xs text-fg-3">
        Your profile name and photo are visible to people you message.
      </p>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-fg-2">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
