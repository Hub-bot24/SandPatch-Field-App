import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { OnlineStatusBadge } from "@/components/status/OnlineStatusBadge";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-30 bg-navy text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight">SandPatch Field App</span>
          <OnlineStatusBadge />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
