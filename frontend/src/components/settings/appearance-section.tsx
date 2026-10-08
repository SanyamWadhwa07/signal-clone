"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { CHAT_COLORS } from "@/lib/chat-colors";
import { cn } from "@/lib/cn";
import { applyTheme, readThemePreference, type ThemePreference } from "@/lib/theme";
import { useUiStore } from "@/stores/ui";

import { SettingsGroup } from "./setting-row";

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function AppearanceSection() {
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());
  const chatColor = useUiStore((state) => state.chatColor);
  const setPreference = useUiStore((state) => state.setPreference);

  return (
    <>
      <SettingsGroup title="Theme">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3 p-4">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                applyTheme(value);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition-colors",
                theme === value
                  ? "border-bubble-out bg-bubble-out/10"
                  : "border-line hover:bg-hover",
              )}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Chat color">
        <div className="p-4">
          <div
            className="mb-4 flex justify-end rounded-xl bg-chat p-3 ring-1 ring-line"
            style={{
              ["--bubble-out" as string]: CHAT_COLORS.find((c) => c.name === chatColor)?.hex,
            }}
          >
            <span className="rounded-[20px] bg-bubble-out px-3.5 py-2 text-base text-white">
              This is how your messages look
            </span>
          </div>
          <div role="radiogroup" aria-label="Chat color" className="flex flex-wrap gap-3">
            {CHAT_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                role="radio"
                aria-checked={chatColor === color.name}
                aria-label={color.label}
                title={color.label}
                onClick={() => setPreference("chatColor", color.name)}
                className="flex size-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-list transition-transform hover:scale-110 focus-visible:ring-2 aria-checked:ring-2 aria-checked:ring-fg"
                style={{ backgroundColor: color.hex }}
              >
                {chatColor === color.name ? <Check size={18} strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </div>
      </SettingsGroup>
    </>
  );
}
