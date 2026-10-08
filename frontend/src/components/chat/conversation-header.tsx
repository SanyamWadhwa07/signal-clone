"use client";

import {
  ArrowLeft,
  Info,
  Lock,
  LogOut,
  MoreHorizontal,
  Phone,
  Search,
  Timer,
  UserPlus,
  Video,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { useConversationTitle, useNameOf } from "@/hooks/use-names";
import { groupsApi, type Conversation } from "@/lib/api";
import { errorMessage } from "@/lib/actions";
import { formatPresence } from "@/lib/format";
import { navigateTo } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth";
import { useConversationsStore } from "@/stores/conversations";
import { usePresenceStore, useTypingUserIds } from "@/stores/presence";
import { toast, useUiStore } from "@/stores/ui";

interface ConversationHeaderProps {
  conversation: Conversation;
  searchOpen: boolean;
  onToggleSearch: () => void;
}

export function ConversationHeader({
  conversation,
  searchOpen,
  onToggleSearch,
}: ConversationHeaderProps) {
  const myId = useAuthStore((state) => state.user?.id);
  const title = useConversationTitle(conversation);
  const nameOf = useNameOf();
  const openModal = useUiStore((state) => state.openModal);
  const detailsOpen = useUiStore((state) => state.detailsOpen);
  const setDetailsOpen = useUiStore((state) => state.setDetailsOpen);
  const typers = useTypingUserIds(conversation.id);
  const peerPresence = usePresenceStore((state) =>
    conversation.peer ? state.byUser[conversation.peer.id] : undefined,
  );

  const isGroup = conversation.type === "group";
  const isNote = !isGroup && conversation.peer?.id === myId;
  const isAdmin = conversation.my_role === "admin";

  let subtitle = "";
  if (typers.length > 0) {
    subtitle = isGroup
      ? `${typers.map((id) => nameOf(id)?.split(" ")[0] ?? "Someone").join(", ")} typing…`
      : "typing…";
  } else if (isGroup) {
    subtitle = `${conversation.member_count} members`;
  } else if (!isNote && conversation.peer) {
    subtitle = formatPresence(
      peerPresence?.online ?? conversation.peer.online,
      peerPresence?.lastSeenAt ?? conversation.peer.last_seen_at,
    );
  }

  function leaveGroup() {
    openModal({
      type: "confirm",
      title: `Leave “${title}”?`,
      message: "You won't receive messages from this group any more.",
      confirmLabel: "Leave",
      destructive: true,
      onConfirm: async () => {
        try {
          await groupsApi.leave(conversation.id);
          useConversationsStore.getState().remove(conversation.id);
          navigateTo("/chats");
        } catch (error) {
          toast.error(errorMessage(error));
        }
      },
    });
  }

  const comingSoon = (what: string) => () => toast.info(`${what} are coming soon`);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-4">
      <IconButton label="Back to chats" className="lg:hidden" onClick={() => navigateTo("/chats")}>
        <ArrowLeft size={22} />
      </IconButton>
      <button
        type="button"
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
        aria-label="Chat details"
      >
        <Avatar
          name={title}
          color={isGroup ? conversation.avatar_color : conversation.peer?.avatar_color}
          url={isGroup ? conversation.avatar_url : conversation.peer?.avatar_url}
          size={36}
          noteToSelf={isNote}
          online={
            !isGroup && !isNote ? (peerPresence?.online ?? conversation.peer?.online) : undefined
          }
        />
        <span className="min-w-0">
          <span className="block truncate text-base leading-tight font-semibold">{title}</span>
          {subtitle ? (
            <span
              className={`block truncate text-xs ${typers.length ? "text-accent" : "text-fg-3"}`}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>

      <div className="flex items-center text-fg">
        {!isNote ? (
          <>
            <IconButton label="Video call" onClick={comingSoon("Video calls")}>
              <Video size={22} strokeWidth={1.6} />
            </IconButton>
            {!isGroup ? (
              <IconButton label="Voice call" onClick={comingSoon("Voice calls")}>
                <Phone size={21} strokeWidth={1.6} />
              </IconButton>
            ) : null}
          </>
        ) : null}
        <IconButton label="Search in chat" active={searchOpen} onClick={onToggleSearch}>
          <Search size={21} strokeWidth={1.6} />
        </IconButton>
        <Menu
          trigger={(props) => (
            <IconButton label="More" {...props}>
              <MoreHorizontal size={23} />
            </IconButton>
          )}
          items={[
            {
              label: "Chat details",
              icon: <Info size={16} />,
              onSelect: () => setDetailsOpen(true),
            },
            {
              label: "Disappearing messages",
              icon: <Timer size={16} />,
              onSelect: () => openModal({ type: "disappearing", conversationId: conversation.id }),
            },
            ...(!isGroup && !isNote
              ? [
                  {
                    label: "View safety number",
                    icon: <Lock size={16} />,
                    onSelect: () =>
                      openModal({
                        type: "safety-number" as const,
                        conversationId: conversation.id,
                      }),
                  },
                ]
              : []),
            ...(isGroup && isAdmin
              ? [
                  {
                    label: "Add members",
                    icon: <UserPlus size={16} />,
                    onSelect: () =>
                      openModal({ type: "add-members" as const, conversationId: conversation.id }),
                  },
                ]
              : []),
            ...(isGroup
              ? [
                  {
                    label: "Leave group",
                    icon: <LogOut size={16} />,
                    onSelect: leaveGroup,
                    destructive: true,
                    separated: true,
                  },
                ]
              : []),
          ]}
        />
      </div>
    </header>
  );
}
