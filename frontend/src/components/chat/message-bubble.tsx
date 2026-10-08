"use client";

import { Copy, CornerUpLeft, MoreHorizontal, RotateCcw, SmilePlus, Trash2 } from "lucide-react";
import { memo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { StatusIcon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { useNameOf } from "@/hooks/use-names";
import { deleteMessageForEveryone, toggleReaction } from "@/lib/actions";
import { avatarTextClass } from "@/lib/avatar";
import { messageKey, type ChatMessage } from "@/lib/chat";
import { cn } from "@/lib/cn";
import { isJumbomoji } from "@/lib/emoji";
import { formatMessageTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useMessagesStore } from "@/stores/messages";
import { usePeopleStore } from "@/stores/people";
import { toast, useUiStore } from "@/stores/ui";

import { AttachmentView, isImage } from "./attachment-view";
import { Countdown } from "./countdown";
import { EmojiPicker } from "./emoji-picker";
import { QUICK_REACTIONS } from "./emoji-data";
import { MessageText } from "./message-text";
import { QuoteBlock } from "./quote-block";
import { ReactionChips } from "./reaction-chips";

const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface MessageBubbleProps {
  message: ChatMessage;
  /** First/last bubble of a same-sender run: controls corners, sender name, avatar, timestamp. */
  first: boolean;
  last: boolean;
  isGroup: boolean;
  isAdmin: boolean;
  highlighted: boolean;
  onReply: (message: ChatMessage) => void;
  onJumpTo: (messageId: number) => void;
}

function MessageBubbleBase({
  message,
  first,
  last,
  isGroup,
  isAdmin,
  highlighted,
  onReply,
  onJumpTo,
}: MessageBubbleProps) {
  const myId = useAuthStore((state) => state.user?.id);
  const sender = usePeopleStore((state) =>
    message.sender_id !== null ? state.users[message.sender_id] : undefined,
  );
  const nameOf = useNameOf();
  const [picker, setPicker] = useState<"closed" | "quick" | "all">("closed");
  const key = messageKey(message);
  const revealed = useUiStore((state) => state.revealedMessage === key);

  const mine = message.sender_id === myId;
  const deleted = message.deleted;
  const failed = message.status === "failed";
  const jumbo = !deleted && !message.attachment && !message.reply_to && isJumbomoji(message.body);
  const onColor = mine && !deleted;
  const deletedByAdmin = deleted && message.meta?.deleted_by !== undefined;
  const showSenderName = isGroup && !mine && first && Boolean(sender);
  const hasImage = !deleted && isImage(message.attachment);
  // An image can run to the bubble's top edge only when nothing sits above it.
  const imageBleedsTop = hasImage && !message.reply_to && !showSenderName;

  // The 24h window is checked when the user clicks (and again by the server); a clock read during
  // render would make this component impure.
  const canDelete = !deleted && message.id !== null && (mine || (isGroup && isAdmin));
  const canInteract = message.id !== null && !deleted && !failed;
  const showMeta = last || failed;

  function confirmDelete() {
    if (Date.now() - Date.parse(message.created_at) > DELETE_WINDOW_MS) {
      toast.error("Messages can only be deleted within 24 hours.");
      return;
    }
    useUiStore.getState().openModal({
      type: "confirm",
      title: "Delete message?",
      message: mine
        ? "This message will be deleted for everyone in the chat."
        : "As an admin, you're deleting this message for everyone in the group.",
      confirmLabel: "Delete for everyone",
      destructive: true,
      onConfirm: () => deleteMessageForEveryone(message),
    });
  }

  function copy() {
    if (!message.body) return;
    navigator.clipboard
      .writeText(message.body)
      .then(() => toast.success("Message copied"))
      .catch(() => toast.error("Couldn't copy the message"));
  }

  /** Tap a bubble to pin its toolbar (touch devices have no hover); links and buttons keep working. */
  function onBubbleClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a,button")) return;
    useUiStore.getState().setRevealedMessage(revealed ? null : key);
  }

  const react = (emoji: string) => {
    setPicker("closed");
    void toggleReaction(message, emoji);
  };

  const meta = showMeta ? (
    <span
      className={cn(
        "float-right mt-[7px] ml-3 inline-flex items-center gap-1.5 text-[13px] leading-none select-none",
        jumbo ? "text-fg-3" : onColor ? "text-white/80" : "text-fg-3",
      )}
    >
      {message.expires_at && message.id !== null ? (
        <Countdown
          expiresAt={message.expires_at}
          onExpire={() =>
            useMessagesStore
              .getState()
              .applyExpired(message.conversation_id, [message.id as number])
          }
        />
      ) : null}
      <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
      {mine && message.status ? <StatusIcon status={message.status} size={13} /> : null}
    </span>
  ) : null;

  return (
    <div
      data-mid={message.id ?? undefined}
      className={cn(
        "group/row flex items-end gap-2 px-4",
        mine ? "flex-row-reverse" : "flex-row",
        first ? "mt-2.5" : "mt-0.5",
      )}
    >
      {isGroup && !mine ? (
        <div className="w-8 shrink-0 self-end">
          {last && sender ? (
            <Avatar
              name={sender.display_name}
              color={sender.avatar_color}
              url={sender.avatar_url}
              size={32}
            />
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 max-w-[min(85%,560px)] flex-col lg:max-w-[min(72%,560px)]",
          mine ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "relative flex max-w-full items-center gap-1",
            mine ? "flex-row-reverse" : "flex-row",
          )}
        >
          <div
            onClick={canInteract ? onBubbleClick : undefined}
            className={cn(
              "relative min-w-0 transition-shadow",
              hasImage && "w-[min(340px,66cqw)] overflow-hidden",
              jumbo
                ? "px-1 text-5xl leading-tight"
                : cn(
                    "px-3 py-[7px] text-base leading-[1.4]",
                    deleted
                      ? "border border-line text-fg-3 italic"
                      : mine
                        ? "bg-bubble-out text-bubble-out-fg"
                        : "bg-bubble-in text-bubble-in-fg",
                    "rounded-[18px]",
                    mine ? !first && "rounded-tr-[4px]" : !first && "rounded-tl-[4px]",
                    mine ? !last && "rounded-br-[4px]" : !last && "rounded-bl-[4px]",
                  ),
              highlighted && "ring-2 ring-accent ring-offset-2 ring-offset-chat",
              message.status === "sending" && "opacity-80",
            )}
            style={{ ["--tick-ink" as string]: "var(--bubble-out)" }}
          >
            <div className="flow-root">
              {deleted ? (
                <span className="inline-flex items-center gap-1.5 text-[15px]">
                  <Trash2 size={14} aria-hidden />
                  {deletedByAdmin
                    ? "This message was deleted by an admin"
                    : "This message was deleted"}
                </span>
              ) : (
                <>
                  {showSenderName && sender ? (
                    <div
                      className={cn(
                        "mb-0.5 truncate text-[15px] font-semibold dark:brightness-[1.7]",
                        avatarTextClass(sender.avatar_color),
                      )}
                    >
                      {nameOf(sender.id) ?? sender.display_name}
                    </div>
                  ) : null}
                  {message.reply_to ? (
                    <QuoteBlock quote={message.reply_to} onDark={onColor} onJump={onJumpTo} />
                  ) : null}
                  {message.attachment ? (
                    <div
                      className={cn(
                        hasImage && "-mx-3.5 mb-1.5",
                        imageBleedsTop && "-mt-2",
                        hasImage && !message.body && !showMeta && "-mb-2",
                      )}
                    >
                      <AttachmentView attachment={message.attachment} onDark={onColor} />
                    </div>
                  ) : null}
                  {message.body ? <MessageText text={message.body} /> : null}
                </>
              )}
              {meta}
            </div>
          </div>

          {canInteract ? (
            <div
              className={cn(
                "pointer-events-none flex shrink-0 items-center opacity-0 transition-opacity",
                "group-hover/row:pointer-events-auto group-hover/row:opacity-100",
                "focus-within:pointer-events-auto focus-within:opacity-100",
                (picker !== "closed" || revealed) && "pointer-events-auto opacity-100",
              )}
            >
              <IconButton
                label="React"
                size={28}
                onClick={() => setPicker((p) => (p === "closed" ? "quick" : "closed"))}
              >
                <SmilePlus size={16} />
              </IconButton>
              <IconButton label="Reply" size={28} onClick={() => onReply(message)}>
                <CornerUpLeft size={16} />
              </IconButton>
              <Menu
                align={mine ? "right" : "left"}
                trigger={(props) => (
                  <IconButton label="More" size={28} {...props}>
                    <MoreHorizontal size={16} />
                  </IconButton>
                )}
                items={[
                  {
                    label: "Reply",
                    icon: <CornerUpLeft size={15} />,
                    onSelect: () => onReply(message),
                  },
                  {
                    label: "Copy text",
                    icon: <Copy size={15} />,
                    onSelect: copy,
                    disabled: !message.body,
                  },
                  {
                    label: "Delete for everyone",
                    icon: <Trash2 size={15} />,
                    onSelect: confirmDelete,
                    destructive: true,
                    disabled: !canDelete,
                    separated: true,
                  },
                ]}
              />
            </div>
          ) : null}

          {picker !== "closed" ? (
            <div className={cn("absolute -top-12 z-20", mine ? "right-0" : "left-0")}>
              {picker === "quick" ? (
                <div className="flex animate-pop-in items-center gap-0.5 rounded-full bg-raised p-1 shadow-pop ring-1 ring-line">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React with ${emoji}`}
                      onClick={() => react(emoji)}
                      className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                  <IconButton label="More emoji" size={32} onClick={() => setPicker("all")}>
                    <SmilePlus size={16} />
                  </IconButton>
                </div>
              ) : (
                <EmojiPicker
                  onPick={react}
                  onClose={() => setPicker("closed")}
                  className="absolute top-0 left-0 -translate-y-[calc(100%-3rem)]"
                />
              )}
            </div>
          ) : null}
        </div>

        {!deleted && message.reactions.length > 0 ? (
          <ReactionChips
            reactions={message.reactions}
            onToggle={(emoji) => void toggleReaction(message, emoji)}
            align={mine ? "end" : "start"}
          />
        ) : null}

        {failed && message.client_id ? (
          <div className="mt-1 flex items-center gap-2 text-xs text-danger" role="alert">
            Failed to send.
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium underline"
              onClick={() =>
                void useMessagesStore.getState().retry(message.conversation_id, message.client_id!)
              }
            >
              <RotateCcw size={11} /> Retry
            </button>
            <button
              type="button"
              className="font-medium underline"
              onClick={() =>
                useMessagesStore.getState().discard(message.conversation_id, message.client_id!)
              }
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);
