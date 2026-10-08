import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate require="app">
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
