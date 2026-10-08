"use client";
/* eslint-disable @next/next/no-img-element -- user uploads served by the API origin */

import { Download, FileText } from "lucide-react";

import type { Attachment } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { formatFileSize } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

/** Images fill the bubble edge to edge (the bubble clips the corners); files get a card. */
export function AttachmentView({
  attachment,
  onDark,
}: {
  attachment: Attachment;
  onDark: boolean;
}) {
  const url = assetUrl(attachment.url);

  if (attachment.mime.startsWith("image/")) {
    return (
      <button
        type="button"
        aria-label={`Open image ${attachment.name}`}
        onClick={() =>
          useUiStore
            .getState()
            .openModal({ type: "lightbox", src: attachment.url, name: attachment.name })
        }
        className="block w-full cursor-zoom-in"
      >
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          draggable={false}
          className="block max-h-[340px] min-h-[100px] w-full object-cover"
        />
      </button>
    );
  }

  return (
    <a
      href={url}
      download={attachment.name}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 max-w-full items-center gap-3 py-1"
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
          onDark ? "bg-white/20" : "bg-black/10 dark:bg-white/15"
        }`}
      >
        <FileText size={22} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-tight font-medium">
          {attachment.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm opacity-70">
          {formatFileSize(attachment.size)} <Download size={13} aria-hidden />
        </span>
      </span>
    </a>
  );
}

export const isImage = (attachment: Attachment | null): boolean =>
  Boolean(attachment?.mime.startsWith("image/"));
