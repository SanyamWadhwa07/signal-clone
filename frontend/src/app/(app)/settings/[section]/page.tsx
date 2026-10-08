"use client";

import { useParams } from "next/navigation";

import { EmptyPane } from "@/components/layout/empty-state";
import { findSection } from "@/components/settings/sections";

export default function SettingsSectionPage() {
  const { section: slug } = useParams<{ section: string }>();
  const section = findSection(slug);

  if (!section) {
    return <EmptyPane title="Setting not found">Pick a section from the list.</EmptyPane>;
  }
  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-6">
      <h2 className="mb-6 text-2xl font-semibold">{section.title}</h2>
      <section.Component />
    </div>
  );
}
