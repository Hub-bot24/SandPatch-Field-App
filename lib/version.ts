import generated from "./version.generated.json";

/** Short commit hash the running build was made from, or null if git wasn't available at build time (e.g. a source tarball). */
export const BUILD_SHA: string | null = generated.sha;

/** ISO 8601 UTC timestamp of when this build was produced (see scripts/generate-version.mjs). */
export const BUILD_TIME: string = generated.buildTime;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A short, fixed-format label like "16 Sep 02:32 UTC · cd15273" for
 * on-screen display (components/status/VersionBadge.tsx) - hand-formatted
 * in UTC rather than via toLocaleString(), so the static-exported page
 * (prerendered once, on whatever machine and in whatever locale runs the
 * build) and the client after hydration always render the identical
 * string, with no server/client locale or timezone to ever disagree
 * about. Takes its inputs as plain arguments (rather than reading
 * BUILD_SHA/BUILD_TIME itself) purely so tests can exercise every case
 * without mocking a module import.
 */
export function formatBuildLabel(sha: string | null, buildTimeIso: string): string {
  const d = new Date(buildTimeIso);
  const when = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  return sha ? `${when} · ${sha}` : when;
}
