/**
 * Ties the whole automatic measurement together for one photo: find the
 * patch's two edges (lib/measurement/autoDetect.ts), read the ruler's
 * printed numbers (lib/measurement/ocrRuler.ts and
 * lib/measurement/trocrRuler.ts), and read each edge's millimetre position
 * directly off those numbers (lib/measurement/readRulerAtEdge.ts). There is
 * deliberately no calibration step anywhere in this path - every photo
 * supplies its own scale from its own ruler, so nothing about a previous
 * photo, or how the camera happened to be held, ever affects this one.
 */

import { blobToGrayscaleImage, blobToRedIsolatedBlob, cropRegionToCanvas } from "@/lib/images";
import { detectPatchEdges } from "./autoDetect";
import {
  recognizeRulerText,
  type CandidateRegion,
  type RulerNumberToken,
  type RulerOcrWorker,
} from "./ocrRuler";
import { readDiameterFromEdges, Y_TOLERANCE_FRACTION } from "./readRulerAtEdge";
import { getTrocrReader, readNumberFromCrop } from "./trocrRuler";

export interface PatchMeasurement {
  diameterMm: number;
  /** 0-1: how sharply the weaker of the two detected edges stood out - purely informational, not a gate (a low-confidence result is still returned, never silently discarded). */
  confidence: number;
}

interface RulerReadout {
  tokens: RulerNumberToken[];
  candidateRegions: CandidateRegion[];
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
async function readRulerAcrossChannels(worker: RulerOcrWorker, photo: Blob): Promise<RulerReadout> {
  const [standard, redIsolatedPhoto] = await Promise.all([
    recognizeRulerText(worker, photo),
    blobToRedIsolatedBlob(photo),
  ]);
  const red = await recognizeRulerText(worker, redIsolatedPhoto);
  return {
    tokens: [...standard.tokens, ...red.tokens],
    candidateRegions: [...standard.candidateRegions, ...red.candidateRegions],
  };
}

/** Caps how many candidate regions get a second, slower reading pass - bounds one photo's worst-case added latency to roughly this many TrOCR calls regardless of how noisy a given photo's background turns out to be. */
const MAX_TROCR_CANDIDATES = 40;
/** Extra margin around a candidate's Tesseract-found bounding box, as a fraction of its own size - a tight word-box rarely gives a reader trained on more naturally-framed text enough surrounding context. */
const CROP_PADDING_FRACTION = 0.4;

/**
 * Re-reads whichever candidate regions (see ocrRuler.ts's
 * CandidateRegion) fall near the scanned line through
 * lib/measurement/trocrRuler.ts's TrOCR-based reader, and returns any
 * numbers it manages to extract as ordinary tokens. This exists because
 * Tesseract's own recognition - not just its confidence scoring - misses
 * numbers a real photo's lighting and background make hard to read, in a
 * way no amount of tuning Tesseract itself closed (confirmed against six
 * real test photos: still only a fraction produced a usable reading even
 * after several rounds of Tesseract-side improvements). TrOCR is expected
 * to read real, messy photographed text far better, since Tesseract's
 * classic engine was built for scanned documents - but that expectation
 * has not been confirmed on a real device in this codebase (this
 * environment's own network policy blocks downloading the model to test
 * with), unlike every other change in lib/measurement/.
 */
async function rereadCandidatesWithTrocr(
  photo: Blob,
  candidates: CandidateRegion[],
  lineY: number,
  maxYDistance: number,
): Promise<RulerNumberToken[]> {
  const inBand = candidates.filter((region) => {
    const centerY = (region.y0 + region.y1) / 2;
    return Math.abs(centerY - lineY) <= maxYDistance;
  });
  if (inBand.length === 0) return [];

  // A first use with no network (the model hasn't been cached yet), an
  // unsupported browser, or the model simply failing to load must not cost
  // the photo its Tesseract-only reading - this whole step is a bonus on
  // top of that, never a replacement it can take down with it.
  let reader: Awaited<ReturnType<typeof getTrocrReader>>;
  try {
    reader = await getTrocrReader();
  } catch {
    return [];
  }

  const tokens: RulerNumberToken[] = [];
  for (const region of inBand.slice(0, MAX_TROCR_CANDIDATES)) {
    try {
      const canvas = await cropRegionToCanvas(photo, region, CROP_PADDING_FRACTION);
      const value = await readNumberFromCrop(reader, canvas);
      if (value === null) continue;
      tokens.push({
        value,
        x: (region.x0 + region.x1) / 2,
        y: (region.y0 + region.y1) / 2,
        // TrOCR's pipeline doesn't surface a per-result confidence score;
        // readMmAtEdge's MIN_RULER_VALUE and plausible-scale checks are
        // what actually guard a token like this against being a misread,
        // exactly as they already do for Tesseract's own tokens.
        confidence: 90,
      });
    } catch {
      // One candidate failing to crop or read (e.g. a transient inference
      // error) shouldn't cost the rest of this photo's candidates.
    }
  }
  return tokens;
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
  const [{ image, scale }, { tokens: ocrTokens, candidateRegions }] = await Promise.all([
    blobToGrayscaleImage(photo),
    readRulerAcrossChannels(worker, photo),
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
  const maxYDistance = originalHeight * Y_TOLERANCE_FRACTION;

  const trocrTokens = await rereadCandidatesWithTrocr(
    photo,
    candidateRegions,
    edgesOriginal.bandCenterY,
    maxYDistance,
  );

  const diameterMm = readDiameterFromEdges([...ocrTokens, ...trocrTokens], edgesOriginal, originalHeight);
  if (diameterMm === null) return null;

  return {
    diameterMm,
    confidence: Math.min(edgesAnalysis.leftConfidence, edgesAnalysis.rightConfidence),
  };
}
