import type { ComponentType } from "react";

import { AppearanceSection } from "./appearance-section";
import { CallsSection, HelpSection, LinkedDevicesSection } from "./placeholder-sections";
import {
  ChatsSection,
  GeneralSection,
  NotificationsSection,
  PrivacySection,
} from "./preference-sections";
import { ProfileSection } from "./profile-section";

export interface SettingsSectionDef {
  slug: string;
  title: string;
  Component: ComponentType;
}

/** Order here is the order of the left-hand settings list. */
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { slug: "profile", title: "Profile", Component: ProfileSection },
  { slug: "general", title: "General", Component: GeneralSection },
  { slug: "appearance", title: "Appearance", Component: AppearanceSection },
  { slug: "chats", title: "Chats", Component: ChatsSection },
  { slug: "notifications", title: "Notifications", Component: NotificationsSection },
  { slug: "privacy", title: "Privacy", Component: PrivacySection },
  { slug: "linked-devices", title: "Linked devices", Component: LinkedDevicesSection },
  { slug: "calls", title: "Calls", Component: CallsSection },
  { slug: "help", title: "Help", Component: HelpSection },
];

export function findSection(slug: string): SettingsSectionDef | undefined {
  return SETTINGS_SECTIONS.find((section) => section.slug === slug);
}
