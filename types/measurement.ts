/**
 * VERSION 2 (FUTURE) — NOT IMPLEMENTED.
 *
 * This describes the future automatic sand-patch measurement contract:
 * detect two perpendicular metric rulers in an overhead photo, establish
 * scale, correct perspective, detect the sand patch boundary, and derive
 * the four diameters for user confirmation.
 *
 * None of this exists in Version 1. See lib/measurement/notImplementedEngine.ts.
 * Do not generate fake diameters or boundaries from this module.
 */

export type CalibrationQuality = "GOOD" | "POOR" | "UNKNOWN";

export interface ImagePoint {
  x: number;
  y: number;
}

export interface MeasurementInputPhoto {
  photoNumber: 1 | 2 | 3 | 4;
  blob: Blob;
}

export interface MeasurementInput {
  recordId: string;
  photos: MeasurementInputPhoto[];
}

export type MeasurementStatus = "NOT_IMPLEMENTED" | "SUCCESS" | "FAILED";

export interface MeasurementResult {
  status: MeasurementStatus;

  diameter1: number | null;
  diameter2: number | null;
  diameter3: number | null;
  diameter4: number | null;
  averageDiameter: number | null;

  /** 0-1 confidence score from the detection model. */
  confidence: number | null;

  /** Detected sand-patch edge, in image-space pixel coordinates. */
  detectedBoundary: ImagePoint[] | null;

  calibrationQuality: CalibrationQuality | null;

  /** Whether camera-angle perspective correction was applied before measuring. */
  perspectiveCorrectionApplied: boolean;

  /** Always true until a human has confirmed the detected values. */
  requiresManualReview: boolean;

  message?: string;
}

/**
 * Future contract for the computer-vision measurement pipeline described in
 * the Version 2 plan (ruler detection -> scale -> perspective correction ->
 * boundary detection -> diameters -> manual review -> confirm into
 * Diameter 1-4). Implementations must require explicit user confirmation
 * before their values are written into a SandPatchRecord.
 */
export interface SandPatchMeasurementEngine {
  measure(input: MeasurementInput): Promise<MeasurementResult>;
}
