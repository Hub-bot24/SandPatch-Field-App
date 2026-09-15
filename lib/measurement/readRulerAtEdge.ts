/**
 * Reads a patch edge's millimetre position directly off the ruler's own
 * printed numbers in the same photo, at the exact point the edge was
 * detected (lib/measurement/autoDetect.ts) - the digital equivalent of a
 * person reading the ruler mark nearest where the patch ends, rather than
 * computing an abstract pixels-per-mm ratio and applying it. There is no
 * separate calibration step, stored value, or job-wide assumption: every
 * photo's own ruler numbers are what its own edges are measured against,
 * so nothing about how the camera was held on any other photo matters.
 *
 * A patch edge essentially never lands exactly on a printed number, so
 * this finds the two nearest numbers that bracket the edge (one on each
 * side) and linearly interpolates between them - the same small mental
 * step a person takes when a measurement falls, say, two-thirds of the
 * way between the "150" and "160" marks. Numbers may increase or decrease
 * left-to-right in the photo (the ruler could be laid down either way);
 * the interpolation is direction-agnostic.
 */

import type { RulerNumberToken } from "./ocrRuler";
import type { DetectedEdges } from "./autoDetect";

/** Only the geometry readDiameterFromEdges needs - a caller re-expressing edges in a different pixel space (see measurePatch.ts) has no reason to also carry along confidence numbers unchanged. */
type EdgeGeometry = Pick<DetectedEdges, "leftEdgeX" | "rightEdgeX" | "bandCenterY">;

/** Below this OCR confidence (0-100), a recognized digit is too likely to be a misread to anchor a measurement on. */
const MIN_CONFIDENCE = 80;
/** Implied local scale outside this pixels-per-mm range indicates a misread digit, not a real ruler marking - wide enough to cover both a close-up macro shot and a wide-angle full-patch shot. */
const MIN_PLAUSIBLE_PX_PER_MM = 0.1;
const MAX_PLAUSIBLE_PX_PER_MM = 50;
/** How far (as a fraction of the photo's height) a ruler number may sit from the scanned band and still count as "on the same line" as the edge - generous, since a ruler has physical width and printed numbers sit somewhere across it, not exactly on the scanned centerline. */
const Y_TOLERANCE_FRACTION = 0.25;

/**
 * Finds the exact millimetre value at pixel column `edgeX`, by locating
 * the two recognized ruler numbers immediately bracketing it (one with
 * x <= edgeX, one with x >= edgeX, both within `maxYDistance` of
 * `lineY`) and interpolating linearly between them. Returns null - never
 * a guess - when no such bracketing pair exists (the edge is beyond the
 * ruler's legible numbers on one side, or nothing nearby was read
 * confidently), when both bracketing numbers show the same printed value
 * (nothing to interpolate between), or when their implied local scale is
 * implausible (a strong sign at least one is a misread).
 */
export function readMmAtEdge(
  tokens: RulerNumberToken[],
  edgeX: number,
  lineY: number,
  maxYDistance: number,
): number | null {
  const candidates = tokens.filter(
    (t) =>
      t.confidence >= MIN_CONFIDENCE &&
      Number.isFinite(t.value) &&
      Number.isFinite(t.x) &&
      Number.isFinite(t.y) &&
      Math.abs(t.y - lineY) <= maxYDistance,
  );

  let left: RulerNumberToken | null = null;
  let right: RulerNumberToken | null = null;
  for (const t of candidates) {
    if (t.x <= edgeX && (!left || t.x > left.x)) left = t;
    if (t.x >= edgeX && (!right || t.x < right.x)) right = t;
  }
  if (!left || !right) return null;
  if (left === right) return left.value;
  if (left.value === right.value) return null;

  const pixelSpan = right.x - left.x;
  if (pixelSpan <= 0) return null;

  const impliedPxPerMm = pixelSpan / Math.abs(right.value - left.value);
  if (
    !Number.isFinite(impliedPxPerMm) ||
    impliedPxPerMm < MIN_PLAUSIBLE_PX_PER_MM ||
    impliedPxPerMm > MAX_PLAUSIBLE_PX_PER_MM
  ) {
    return null;
  }

  const t = (edgeX - left.x) / pixelSpan;
  return left.value + t * (right.value - left.value);
}

/**
 * Reads both of a detected patch's edges off the ruler's numbers and
 * returns the diameter between them - null if either edge couldn't be
 * read confidently (see readMmAtEdge), leaving the caller to fall back to
 * manual measurement rather than accept a partial or fabricated result.
 * `imageHeight` is the photo's height in the same pixel space as `edges`
 * and the tokens in `tokens`.
 */
export function readDiameterFromEdges(
  tokens: RulerNumberToken[],
  edges: EdgeGeometry,
  imageHeight: number,
): number | null {
  const maxYDistance = imageHeight * Y_TOLERANCE_FRACTION;
  const leftMm = readMmAtEdge(tokens, edges.leftEdgeX, edges.bandCenterY, maxYDistance);
  const rightMm = readMmAtEdge(tokens, edges.rightEdgeX, edges.bandCenterY, maxYDistance);
  if (leftMm === null || rightMm === null) return null;

  const diameterMm = Math.abs(rightMm - leftMm);
  return diameterMm > 0 ? diameterMm : null;
}
