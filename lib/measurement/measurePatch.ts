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

import { blobToGrayscaleImage, blobToRedIsolatedBlob } from "@/lib/images";
import { detectPatchEdges } from "./autoDetect";
import { recognizeRulerNumbers, type RulerNumberToken, type RulerOcrWorker } from "./ocrRuler";
import { readDiameterFromEdges } from "./readRulerAtEdge";

export interface PatchMeasurement {
  diameterMm: number;
  /** 0-1: how sharply the weaker of the two detected edges stood out - purely informational, not a gate (a low-confidence result is still returned, never silently discarded). */
  confidence: number;
}

/**
 * Reads ruler numbers twice: once from the photo as-is, once from a
 * version with only "redness" kept as brightness (see
 * lib/images/redIsolate.ts). Confirmed against a real ruler photo with
 * red-printed major numbers: the standard pass alone found none of them,
 * anywhere, at any confidence - red ink loses too much contrast in
 * standard grayscale conversion to read regardless of confidence
 * threshold, so a second pass built for it is the only way to read that
 * ruler at all, not just a way to read it more confidently. Both passes
 * run on the same shared worker (see ocrRuler.ts), so this roughly
 * doubles one photo's OCR time; readMmAtEdge's existing confidence and
 * plausibility checks are what keep a stray misread from either pass out
 * of the final measurement, exactly as they already did for the single
 * pass.
 */
async function recognizeRulerNumbersAcrossChannels(worker: RulerOcrWorker, photo: Blob): Promise<RulerNumberToken[]> {
  const [standardTokens, redIsolatedPhoto] = await Promise.all([
    recognizeRulerNumbers(worker, photo),
    blobToRedIsolatedBlob(photo),
  ]);
  const redTokens = await recognizeRulerNumbers(worker, redIsolatedPhoto);
  return [...standardTokens, ...redTokens];
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
    recognizeRulerNumbersAcrossChannels(worker, photo),
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
