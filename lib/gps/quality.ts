import type { GpsQuality } from "@/types/record";

const GOOD_MAX_M = 10;
const CHECK_MAX_M = 20;

/**
 * GOOD <= 10 m, CHECK <= 20 m, otherwise POOR. Never blocks saving - the
 * caller only uses this to flag the reading, per the field spec.
 */
export function classifyGpsAccuracy(accuracyM: number | null | undefined): GpsQuality | null {
  if (typeof accuracyM !== "number" || !Number.isFinite(accuracyM) || accuracyM < 0) {
    return null;
  }
  if (accuracyM <= GOOD_MAX_M) return "GOOD";
  if (accuracyM <= CHECK_MAX_M) return "CHECK";
  return "POOR";
}
