export type Direction = "LHS" | "RHS" | "Centre" | "Other";

export const DIRECTIONS: Direction[] = ["LHS", "RHS", "Centre", "Other"];

export type ControlLine = "Left Wheel Path" | "Diff" | "Right Wheel Path" | "Shoulder" | "Other";

// Ordered left-to-right across a lane cross-section. "Diff" is the strip
// between the two wheel paths (after the vehicle differential, which sits
// between the wheels).
export const CONTROL_LINES: ControlLine[] = [
  "Left Wheel Path",
  "Diff",
  "Right Wheel Path",
  "Shoulder",
  "Other",
];

export type SandVolumeMl = 50 | 100;

export const SAND_VOLUMES: SandVolumeMl[] = [50, 100];

export type RecordStatus = "READY" | "INCOMPLETE";

export type GpsQuality = "GOOD" | "CHECK" | "POOR";

/**
 * The GPS reading captured with a record. Kept as a nested snapshot (rather
 * than only lat/lng/accuracy columns) so a future field can be added
 * (e.g. altitude) without another migration.
 */
export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
}

/**
 * A single sand patch test record. This is QA evidence: diameters, chainage
 * and notes are only ever changed by explicit user edits (see lib/db
 * repositories) - averageDiameterMm/textureDepthMm are the sole derived
 * fields, recomputed from the four diameters + sandVolumeMl on every save.
 */
export interface SandPatchRecord {
  id: string;
  createdAt: string;
  updatedAt: string;

  road: string;
  contractJobNumber: string;
  lotNumber: string;
  operator: string;

  testDateTime: string;

  gps: GpsReading | null;

  chainageKm: number | null;
  offsetM: number | null;
  direction: Direction | null;
  controlLine: ControlLine | null;

  existingSurface: string;
  existingAggregateSize: string;
  proposedAggregateSize: string;

  sandVolumeMl: SandVolumeMl;

  diameter1Mm: number | null;
  diameter2Mm: number | null;
  diameter3Mm: number | null;
  diameter4Mm: number | null;

  averageDiameterMm: number | null;
  textureDepthMm: number | null;

  notes: string;

  status: RecordStatus;
}

export type PhotoNumber = 1 | 2 | 3 | 4;

export const PHOTO_NUMBERS: PhotoNumber[] = [1, 2, 3, 4];

/**
 * A photo is associated with its parent record by `recordId` (a UUID),
 * never by array position - see lib/db/photoRepository.ts.
 */
export interface PhotoRecord {
  id: string;
  recordId: string;
  photoNumber: PhotoNumber;
  blob: Blob;
  createdAt: string;
}
