import type {
  MeasurementInput,
  MeasurementResult,
  SandPatchMeasurementEngine,
} from "@/types/measurement";

/**
 * Version 1 placeholder for the Version 2 automatic ruler/sand-edge
 * measurement pipeline. This intentionally does nothing: it never
 * generates diameters or a boundary from an image. It exists only so the
 * rest of the app (and a future real engine) can share one call shape.
 */
export class NotImplementedMeasurementEngine implements SandPatchMeasurementEngine {
  async measure(_input: MeasurementInput): Promise<MeasurementResult> {
    return {
      status: "NOT_IMPLEMENTED",
      diameter1: null,
      diameter2: null,
      diameter3: null,
      diameter4: null,
      averageDiameter: null,
      confidence: null,
      detectedBoundary: null,
      calibrationQuality: null,
      perspectiveCorrectionApplied: false,
      requiresManualReview: true,
      message:
        "Automatic sand patch measurement is not implemented in Version 1. Enter the four diameters manually.",
    };
  }
}

export const sandPatchMeasurementEngine: SandPatchMeasurementEngine =
  new NotImplementedMeasurementEngine();
