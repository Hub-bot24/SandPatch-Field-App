"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { IconWifi, IconWifiOff } from "@/components/icons";

export function OnlineStatusBadge() {
  const online = useOnlineStatus();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        online ? "bg-white/10 text-white" : "bg-check text-white"
      }`}
    >
      {online ? <IconWifi className="h-3.5 w-3.5" /> : <IconWifiOff className="h-3.5 w-3.5" />}
      {online ? "Online" : "Offline"}
    </span>
  );
}
