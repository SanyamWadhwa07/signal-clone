"use client";

import {
  ArrowUp,
  Camera,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Smile,
  X,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { ACCEPT_ATTRIBUTE, useAttachmentUpload } from "@/hooks/use-attachment-upload";
import { useTypingBroadcast } from "@/hooks/use-typing-broadcast";
import type { ChatMessage } from "@/lib/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/config";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import { useMessagesStore } from "@/stores/messages";
import { toast, useUiStore } from "@/stores/ui";

import { EmojiPicker } from "./emoji-picker";
import { QuoteBlock } from "./quote-block";

/** Unsent text survives switching chats (kept in memory for the session, like Signal's drafts). */
const drafts = new Map<number, string>();

const MAX_INPUT_HEIGHT = 140;

export interface ComposerHandle {
  focus: () => void;
  attach: (file: File) => void;
}

interface ComposerProps {
  conversationId: number;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { conversationId, replyTo, onCancelReply },
  ref,
) {
  const enterToSend = useUiStore((state) => state.enterToSend);
  const [text, setText] = useState(() => drafts.get(conversationId) ?? "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, attach, clear } = useAttachmentUpload();
  const typing = useTypingBroadcast(conversationId);

  useImperativeHandle(
    ref,
    () => ({ focus: () => inputRef.current?.focus(), attach: (file) => void attach(file) }),
    [attach],
  );

  // Keep the draft per conversation; the parent remounts this component when the chat changes.
  useEffect(() => {
    drafts.set(conversationId, text);
  }, [conversationId, text]);

  const resize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, []);

  useEffect(resize, [text, resize]);
  useEffect(() => inputRef.current?.focus(), [conversationId]);
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const hasContent = text.trim().length > 0 || Boolean(pending?.attachment);
  const canSend = hasContent && !pending?.uploading;

  function submit() {
    if (!canSend) return;
    const body = text.trim() || null;
    const attachment = pending?.attachment ?? null;
    const reply = replyTo;
    setText("");
    drafts.delete(conversationId);
    clear();
    onCancelReply();
    typing.stop();
    void useMessagesStore.getState().send(conversationId, { body, replyTo: reply, attachment });
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return; // IME candidate selection must not send
    if (event.key === "Enter") {
      const wantsSend = enterToSend ? !event.shiftKey : event.ctrlKey || event.metaKey;
      if (wantsSend) {
        event.preventDefault();
        submit();
      }
    } else if (event.key === "Escape" && replyTo) {
      event.stopPropagation();
      onCancelReply();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.files)[0];
    if (file) {
      event.preventDefault();
      void attach(file);
    }
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next.slice(0, MAX_MESSAGE_LENGTH));
    typing.onType(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function openFilePicker(imagesOnly: boolean) {
    if (fileInputRef.current) {
      fileInputRef.current.accept = imagesOnly
        ? "image/png,image/jpeg,image/gif,image/webp"
        : ACCEPT_ATTRIBUTE;
      fileInputRef.current.click();
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - text.length;

  const attachMenu = (
    <Menu
      up
      align="left"
      trigger={(props) => (
        <IconButton label="Attach" size={40} className="text-fg" {...props}>
          <Plus size={26} strokeWidth={1.6} />
        </IconButton>
      )}
      items={[
        {
          label: "Photo",
          icon: <ImageIcon size={16} />,
          onSelect: () => openFilePicker(true),
        },
        {
          label: "File",
          icon: <Paperclip size={16} />,
          onSelect: () => openFilePicker(false),
        },
      ]}
    />
  );

  return (
    <div className="shrink-0 px-4 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {replyTo?.id != null ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-field px-3 py-2">
          <div className="min-w-0 flex-1">
            <QuoteBlock
              compact
              onDark={false}
              quote={{
                id: replyTo.id,
                sender_id: replyTo.sender_id,
                kind: replyTo.kind,
                body: replyTo.body,
                attachment: replyTo.attachment,
                deleted: replyTo.deleted,
              }}
            />
          </div>
          <IconButton label="Cancel reply" size={28} onClick={onCancelReply}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}

      {pending ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-field px-3 py-2">
          {pending.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={pending.previewUrl} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-selected text-fg-2">
              <FileText size={22} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pending.file.name}</p>
            <p className="text-xs text-fg-3">{formatFileSize(pending.file.size)}</p>
          </div>
          {pending.uploading ? <Spinner size={18} /> : null}
          <IconButton label="Remove attachment" size={28} onClick={clear}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}

      <div className="relative flex items-end gap-2">
        <IconButton
          label="Emoji"
          size={40}
          className="text-fg max-lg:hidden"
          active={emojiOpen}
          onClick={() => setEmojiOpen((open) => !open)}
        >
          <Smile size={24} strokeWidth={1.6} />
        </IconButton>
        {emojiOpen ? (
          <EmojiPicker
            onPick={insertEmoji}
            onClose={() => setEmojiOpen(false)}
            className="absolute bottom-full left-0 mb-2"
          />
        ) : null}

        <div className="relative min-w-0 flex-1">
          {/* Phone: "+" and camera live inside the pill, as in Signal mobile. */}
          <div className="absolute bottom-0.5 left-0.5 z-10 lg:hidden">{attachMenu}</div>
          <IconButton
            label="Take or choose a photo"
            size={36}
            className="absolute right-0.5 bottom-0.5 z-10 text-fg-2 lg:hidden"
            onClick={() => openFilePicker(true)}
          >
            <Camera size={22} strokeWidth={1.6} />
          </IconButton>
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Message"
            aria-label="Message"
            onChange={(event) => {
              setText(event.target.value);
              typing.onType(event.target.value);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={typing.stop}
            className={cn(
              "block max-h-[140px] min-h-10 max-lg:min-h-11 w-full resize-none rounded-[20px] bg-field px-4 py-[9px] text-base max-lg:pr-11 max-lg:pl-11",
              "leading-[22px] outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-accent/60",
            )}
          />
          {remaining < 500 ? (
            <p
              className={cn(
                "mt-1 text-right text-xs",
                remaining < 100 ? "text-danger" : "text-fg-3",
              )}
            >
              {remaining} characters left
            </p>
          ) : null}
        </div>

        <div className="max-lg:hidden">{attachMenu}</div>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attach(file);
            event.target.value = "";
          }}
        />

        {hasContent ? (
          <button
            type="button"
            aria-label="Send message"
            disabled={!canSend}
            onClick={submit}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bubble-out text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <ArrowUp size={22} strokeWidth={2.2} />
          </button>
        ) : (
          <>
            <IconButton
              label="Voice message"
              size={40}
              className="text-fg max-lg:hidden"
              onClick={() => toast.info("Voice messages are coming soon")}
            >
              <Mic size={24} strokeWidth={1.6} />
            </IconButton>
            <button
              type="button"
              aria-label="Send message"
              disabled
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bubble-out text-white opacity-70 lg:hidden"
            >
              <ArrowUp size={22} strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
