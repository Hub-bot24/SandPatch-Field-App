/**
 * Ties the whole automatic measurement together for one photo: find the
 * patch's two edges (lib/measurement/autoDetect.ts), read the ruler's
 * printed numbers (lib/measurement/ocrRuler.ts), and read each edge's
 * millimetre position directly off those numbers
 * (lib/measurement/readRulerAtEdge.ts). There is deliberately no
 * calibration step anywhere in this path - every photo supplies its own
 * scale from its own ruler, so nothing about a previous photo, or how the
 * camera happened to be held, ever affects this one.
 */

import { blobToGrayscaleImage } from "@/lib/images";
import { detectPatchEdges } from "./autoDetect";
import { recognizeRulerNumbers, type RulerOcrWorker } from "./ocrRuler";
import { readDiameterFromEdges } from "./readRulerAtEdge";

export interface PatchMeasurement {
  diameterMm: number;
  /** 0-1: how sharply the weaker of the two detected edges stood out - purely informational, not a gate (a low-confidence result is still returned, never silently discarded). */
  confidence: number;
}

/**
 * Measures one patch photo end to end. `worker` (see
 * ocrRuler.ts's createRulerOcrWorker()) is supplied by the caller so a
 * whole 4-photo guided-capture run can share one Tesseract worker instead
 * of paying its start-up cost four times over. Returns null - never a
 * guess - when the patch's edges aren't clear enough to trust, or the
 * ruler's numbers can't be read confidently enough near both edges; the
 * caller should fall back to manual "Measure from Photo" in that case.
 */
export async function measurePatchFromPhoto(worker: RulerOcrWorker, photo: Blob): Promise<PatchMeasurement | null> {
  const [{ image, scale }, tokens] = await Promise.all([
    blobToGrayscaleImage(photo),
    recognizeRulerNumbers(worker, photo),
  ]);

  const edgesAnalysis = detectPatchEdges(image);
  if (!edgesAnalysis) return null;

  // Edges were found in the downsampled analysis image (see
  // lib/images/grayscale.ts), but the ruler numbers were read from the
  // original, full-resolution photo (OCR needs the real resolution to
  // read small print) - convert the edges up to that same original-photo
  // pixel space before matching them against the numbers' positions.
  const edgesOriginal = {
    leftEdgeX: edgesAnalysis.leftEdgeX / scale,
    rightEdgeX: edgesAnalysis.rightEdgeX / scale,
    bandCenterY: edgesAnalysis.bandCenterY / scale,
  };
  const originalHeight = image.height / scale;

  const diameterMm = readDiameterFromEdges(tokens, edgesOriginal, originalHeight);
  if (diameterMm === null) return null;

  return {
    diameterMm,
    confidence: Math.min(edgesAnalysis.leftConfidence, edgesAnalysis.rightConfidence),
  };
}
