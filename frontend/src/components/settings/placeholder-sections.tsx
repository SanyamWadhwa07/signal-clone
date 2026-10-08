import { Laptop, Phone, Video } from "lucide-react";
import type { ReactNode } from "react";

import { SettingRow, SettingsGroup, SoonBadge } from "./setting-row";

function ComingSoonCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-list px-6 py-12 text-center ring-1 ring-line">
      <span className="flex size-14 items-center justify-center rounded-full bg-field text-fg-2">
        {icon}
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <SoonBadge />
      <p className="mt-3 max-w-sm text-sm text-fg-3">{text}</p>
    </div>
  );
}

export function LinkedDevicesSection() {
  return (
    <ComingSoonCard
      icon={<Laptop size={26} />}
      title="Linked devices"
      text="Link Signal on your phone with this computer. This is a placeholder in the demo."
    />
  );
}

export function CallsSection() {
  return (
    <>
      <ComingSoonCard
        icon={<Video size={26} />}
        title="Voice and video calls"
        text="Calling is a placeholder in this demo. Chats, groups and receipts are fully working."
      />
      <div className="mt-6">
        <SettingsGroup title="Calls">
          <SettingRow
            label="Always relay calls"
            description="Hide your IP address from contacts"
            control={<SoonBadge />}
          />
          <SettingRow
            label="Call ringtone"
            description="Choose how incoming calls sound"
            control={<Phone size={16} className="text-fg-3" />}
          />
        </SettingsGroup>
      </div>
    </>
  );
}

export function HelpSection() {
  return (
    <>
      <SettingsGroup title="About this app">
        <SettingRow label="Signal Clone" description="Version 1.0.0" />
        <SettingRow
          label="End-to-end encryption"
          description="Simulated. Messages are stored on the demo server; no real cryptographic keys are exchanged."
        />
        <SettingRow
          label="Not affiliated with Signal"
          description="An unofficial, educational recreation of the Signal Desktop experience built for a coding assignment."
        />
      </SettingsGroup>
    </>
  );
}
