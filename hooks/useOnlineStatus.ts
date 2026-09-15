"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// The static-exported shell is prerendered in Node, where `navigator`
// does not exist - assume online there; the client snapshot corrects it
// immediately after hydration.
function getServerSnapshot() {
  return true;
}

/** Tracks navigator.onLine for the ONLINE/OFFLINE indicator. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
