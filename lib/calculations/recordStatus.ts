import type { PhotoNumber, RecordStatus } from "@/types/record";

export interface RecordStatusInput {
  chainageKm: number | null | undefined;
  diameter1Mm: number | null | undefined;
  diameter2Mm: number | null | undefined;
  diameter3Mm: number | null | undefined;
  diameter4Mm: number | null | undefined;
}

function hasChainage(chainageKm: number | null | undefined): boolean {
  return typeof chainageKm === "number" && Number.isFinite(chainageKm) && chainageKm >= 0;
}

function hasAllDiameters(record: RecordStatusInput): boolean {
  return [record.diameter1Mm, record.diameter2Mm, record.diameter3Mm, record.diameter4Mm].every(
    (d) => typeof d === "number" && Number.isFinite(d) && d > 0,
  );
}

function hasAllFourPhotos(presentPhotoNumbers: readonly PhotoNumber[]): boolean {
  const present = new Set(presentPhotoNumbers);
  return present.has(1) && present.has(2) && present.has(3) && present.has(4);
}

/**
 * READY only when chainage exists, all four diameters exist, and all four
 * photos exist - matching the field spec exactly. Everything else is
 * INCOMPLETE, which is an expected, savable state (a test can be revisited).
 */
export function computeRecordStatus(
  record: RecordStatusInput,
  presentPhotoNumbers: readonly PhotoNumber[],
): RecordStatus {
  if (hasChainage(record.chainageKm) && hasAllDiameters(record) && hasAllFourPhotos(presentPhotoNumbers)) {
    return "READY";
  }
  return "INCOMPLETE";
}
