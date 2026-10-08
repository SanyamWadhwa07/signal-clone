"use client";

import {
  Check,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Timer,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { PersonRow } from "@/components/ui/person-row";
import { useConversationTitle } from "@/hooks/use-names";
import { conversationsApi, groupsApi, type Conversation, type Member } from "@/lib/api";
import { errorMessage } from "@/lib/actions";
import { prettyPhone } from "@/lib/countries";
import { formatDuration } from "@/lib/format";
import { navigateTo } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { usePeopleStore } from "@/stores/people";
import { toast, useUiStore } from "@/stores/ui";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-4 pt-5 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
      {children}
    </h3>
  );
}

function ActionRow({
  icon,
  label,
  value,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-hover ${
        destructive ? "text-danger" : ""
      }`}
    >
      <span className={destructive ? "" : "text-fg-2"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {value ? <span className="text-fg-3">{value}</span> : null}
    </button>
  );
}

/** Small click-to-edit text field used for group name/description and contact nicknames. */
function InlineEdit({
  value,
  placeholder,
  maxLength,
  editable,
  multiline,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  maxLength: number;
  editable: boolean;
  multiline?: boolean;
  onSave: (next: string) => Promise<void>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className={`flex items-start justify-center gap-1.5 ${className ?? ""}`}>
        <span className={value ? "" : "text-fg-3"}>{value || placeholder}</span>
        {editable ? (
          <IconButton
            label="Edit"
            size={24}
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <Pencil size={13} />
          </IconButton>
        ) : null}
      </div>
    );
  }

  const Field = multiline ? "textarea" : "input";
  return (
    <div className="flex w-full items-start gap-1.5">
      <Field
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={maxLength}
        autoFocus
        aria-label={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !multiline) void save();
          if (event.key === "Escape") {
            event.stopPropagation();
            setEditing(false);
          }
        }}
        className="min-h-9 w-full resize-none rounded-lg bg-field px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent"
        {...(multiline ? { rows: 3 } : {})}
      />
      <IconButton label="Save" size={32} disabled={busy} onClick={() => void save()}>
        <Check size={16} />
      </IconButton>
      <IconButton label="Cancel" size={32} onClick={() => setEditing(false)}>
        <X size={16} />
      </IconButton>
    </div>
  );
}

export function ConversationDetails({ conversation }: { conversation: Conversation }) {
  const me = useAuthStore((state) => state.user);
  const title = useConversationTitle(conversation);
  const openModal = useUiStore((state) => state.openModal);
  const setDetailsOpen = useUiStore((state) => state.setDetailsOpen);
  const members = usePeopleStore((state) => state.membersByConversation[conversation.id]);
  const contacts = usePeopleStore((state) => state.contacts);

  const isGroup = conversation.type === "group";
  const isAdmin = conversation.my_role === "admin";
  const peer = conversation.peer;
  const isNote = !isGroup && peer?.id === me?.id;
  const contact = peer ? contacts.find((c) => c.user.id === peer.id) : undefined;
  const timer = conversation.disappearing_seconds;

  useEffect(() => {
    if (isGroup && !members)
      void usePeopleStore
        .getState()
        .loadMembers(conversation.id)
        .catch(() => {});
  }, [isGroup, members, conversation.id]);

  async function refreshGroup() {
    await Promise.all([
      usePeopleStore.getState().loadMembers(conversation.id),
      useConversationsStore.getState().fetchOne(conversation.id),
    ]);
  }

  async function updateGroup(patch: { name?: string; description?: string | null }) {
    const updated = await conversationsApi.update(conversation.id, patch);
    useConversationsStore.getState().upsert(updated);
  }

  function memberAction(member: Member, action: "promote" | "demote" | "remove") {
    const name = member.user.display_name;
    const run = async () => {
      if (action === "remove") await groupsApi.removeMember(conversation.id, member.user.id);
      else
        await groupsApi.setRole(
          conversation.id,
          member.user.id,
          action === "promote" ? "admin" : "member",
        );
      await refreshGroup();
    };
    if (action === "remove") {
      openModal({
        type: "confirm",
        title: `Remove ${name}?`,
        message: "They will no longer receive messages from this group.",
        confirmLabel: "Remove",
        destructive: true,
        onConfirm: run,
      });
    } else {
      run().catch((error) => toast.error(errorMessage(error)));
    }
  }

  function leaveGroup() {
    openModal({
      type: "confirm",
      title: `Leave “${title}”?`,
      message: "You won't receive messages from this group any more.",
      confirmLabel: "Leave",
      destructive: true,
      onConfirm: async () => {
        await groupsApi.leave(conversation.id);
        useConversationsStore.getState().remove(conversation.id);
        navigateTo("/chats");
      },
    });
  }

  return (
    <aside
      aria-label="Chat details"
      className="absolute inset-0 z-20 flex w-full flex-col overflow-y-auto border-l border-line bg-chat xl:static xl:inset-auto xl:w-[320px] xl:shrink-0"
    >
      <header className="flex h-16 shrink-0 items-center justify-between px-4">
        <h2 className="text-base font-semibold">{isGroup ? "Group info" : "Chat info"}</h2>
        <IconButton label="Close details" onClick={() => setDetailsOpen(false)}>
          <X size={20} />
        </IconButton>
      </header>

      <div className="flex flex-col items-center px-6 pb-2 text-center">
        <Avatar
          name={title}
          color={isGroup ? conversation.avatar_color : peer?.avatar_color}
          url={isGroup ? conversation.avatar_url : peer?.avatar_url}
          size={96}
          noteToSelf={isNote}
        />
        {isGroup ? (
          <>
            <InlineEdit
              value={conversation.name ?? ""}
              placeholder="Group name"
              maxLength={32}
              editable={isAdmin}
              onSave={(name) => updateGroup({ name })}
              className="mt-3 text-lg font-semibold"
            />
            <InlineEdit
              value={conversation.description ?? ""}
              placeholder={isAdmin ? "Add a group description" : "No description"}
              maxLength={480}
              multiline
              editable={isAdmin}
              onSave={(description) => updateGroup({ description: description || null })}
              className="mt-1 text-sm text-fg-2"
            />
          </>
        ) : (
          <>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            {!isNote && peer ? (
              <p className="mt-0.5 text-sm text-fg-3">
                {peer.username ? `@${peer.username} · ` : ""}
                {prettyPhone(peer.phone)}
              </p>
            ) : null}
            {peer?.about && !isNote ? <p className="mt-2 text-sm text-fg-2">{peer.about}</p> : null}
          </>
        )}
      </div>

      {!isGroup && !isNote && peer ? (
        <div className="mt-2 px-4">
          {contact ? (
            <InlineEdit
              value={contact.nickname ?? ""}
              placeholder="Add a nickname"
              maxLength={50}
              editable
              onSave={(nickname) =>
                usePeopleStore.getState().renameContact(contact.id, nickname || null)
              }
              className="justify-center text-sm text-fg-2"
            />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="mx-auto flex"
              onClick={() =>
                usePeopleStore
                  .getState()
                  .addContact({ phone: peer.phone })
                  .then(() => toast.success(`${peer.display_name} added to contacts`))
                  .catch((error) => toast.error(errorMessage(error)))
              }
            >
              <UserPlus size={15} /> Add to contacts
            </Button>
          )}
        </div>
      ) : null}

      <SectionTitle>Privacy</SectionTitle>
      <ActionRow
        icon={<Timer size={18} />}
        label="Disappearing messages"
        value={timer ? formatDuration(timer) : "Off"}
        onClick={() => openModal({ type: "disappearing", conversationId: conversation.id })}
      />
      {!isGroup && !isNote ? (
        <ActionRow
          icon={<Lock size={18} />}
          label="View safety number"
          onClick={() => openModal({ type: "safety-number", conversationId: conversation.id })}
        />
      ) : null}

      {isGroup ? (
        <>
          <SectionTitle>{`${conversation.member_count} members`}</SectionTitle>
          {isAdmin ? (
            <ActionRow
              icon={<UserPlus size={18} />}
              label="Add members"
              onClick={() => openModal({ type: "add-members", conversationId: conversation.id })}
            />
          ) : null}
          <ul className="px-2">
            {(members ?? []).map((member) => {
              const self = member.user.id === me?.id;
              return (
                <li key={member.user.id}>
                  <PersonRow
                    name={self ? `${member.user.display_name} (You)` : member.user.display_name}
                    avatarName={member.user.display_name}
                    subtitle={member.user.about ?? undefined}
                    color={member.user.avatar_color}
                    avatarUrl={member.user.avatar_url}
                    trailing={
                      <span className="flex items-center gap-1">
                        {member.role === "admin" ? (
                          <span className="rounded-full bg-field px-2 py-0.5 text-[11px] font-medium text-fg-2">
                            Admin
                          </span>
                        ) : null}
                        {isAdmin && !self ? (
                          <Menu
                            trigger={(props) => (
                              <IconButton
                                label={`Manage ${member.user.display_name}`}
                                size={28}
                                {...props}
                              >
                                <MoreHorizontal size={16} />
                              </IconButton>
                            )}
                            items={[
                              member.role === "admin"
                                ? {
                                    label: "Remove as admin",
                                    onSelect: () => memberAction(member, "demote"),
                                  }
                                : {
                                    label: "Make admin",
                                    onSelect: () => memberAction(member, "promote"),
                                  },
                              {
                                label: "Remove from group",
                                icon: <UserMinus size={15} />,
                                onSelect: () => memberAction(member, "remove"),
                                destructive: true,
                                separated: true,
                              },
                            ]}
                          />
                        ) : null}
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-2 mb-6 border-t border-line pt-2">
            <ActionRow
              icon={<LogOut size={18} />}
              label="Leave group"
              destructive
              onClick={leaveGroup}
            />
          </div>
        </>
      ) : null}
    </aside>
  );
}
