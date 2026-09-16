import { BUILD_SHA, BUILD_TIME, formatBuildLabel } from "@/lib/version";

/**
 * Shows which build is running, e.g. "16 Sep 02:32 UTC · cd15273" - the
 * whole point is answering "is this the latest app?" without guessing
 * from a screenshot or asking someone to check. The value is fixed at
 * build time (scripts/generate-version.mjs), so unlike OnlineStatusBadge
 * this never changes while the page is open and needs no client-side
 * state or effect.
 */
export function VersionBadge() {
  return <p className="text-xs text-white/60">{formatBuildLabel(BUILD_SHA, BUILD_TIME)}</p>;
}
