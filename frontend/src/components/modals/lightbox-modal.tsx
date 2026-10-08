"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded image from another origin */

import { Download, X } from "lucide-react";
import { useEffect } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { assetUrl } from "@/lib/config";
import { useUiStore } from "@/stores/ui";

export function LightboxModal({ src, name }: { src: string; name: string }) {
  const close = useUiStore((state) => state.closeModal);
  const url = assetUrl(src);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black/90"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="truncate text-sm">{name}</span>
        <div className="flex gap-1 text-white">
          <a
            href={url}
            download={name}
            aria-label="Download"
            title="Download"
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/10"
          >
            <Download size={20} />
          </a>
          <IconButton
            label="Close"
            onClick={close}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </IconButton>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <img src={url} alt={name} className="max-h-full max-w-full rounded-md object-contain" />
      </div>
    </div>
  );
}
