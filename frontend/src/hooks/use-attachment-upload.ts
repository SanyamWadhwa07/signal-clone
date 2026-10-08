"use client";

import { useCallback, useState } from "react";

import { uploadsApi, type Attachment } from "@/lib/api";
import { errorMessage } from "@/lib/actions";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { toast } from "@/stores/ui";

/** Mirrors the backend allow-list (extension + MIME); the server re-checks content and size. */
const ALLOWED: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "application/zip": [".zip"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

export const ACCEPT_ATTRIBUTE = Object.entries(ALLOWED)
  .flatMap(([mime, extensions]) => [mime, ...extensions])
  .join(",");

export function validateFile(file: File): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "Files can be up to 10 MB.";
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const known = ALLOWED[file.type];
  if (!known || !known.includes(extension)) return "This type of file can't be sent.";
  return null;
}

export interface PendingAttachment {
  file: File;
  /** Local preview for images. */
  previewUrl: string | null;
  attachment: Attachment | null;
  uploading: boolean;
}

/** One attachment at a time: pick/paste/drop a file, it uploads immediately, send links it. */
export function useAttachmentUpload() {
  const [pending, setPending] = useState<PendingAttachment | null>(null);

  const clear = useCallback(() => {
    setPending((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  const attach = useCallback(async (file: File) => {
    const problem = validateFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPending((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl, attachment: null, uploading: true };
    });
    try {
      const attachment = await uploadsApi.upload(file);
      setPending((current) =>
        current?.file === file ? { ...current, attachment, uploading: false } : current,
      );
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't upload that file."));
      setPending((current) => {
        if (current?.file !== file) return current;
        if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
    }
  }, []);

  return { pending, attach, clear };
}
