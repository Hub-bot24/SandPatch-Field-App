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
 * this finds the two nearest recognized numbers and linearly interpolates
 * or extrapolates between them - the same small mental step a person
 * takes when a measurement falls, say, two-thirds of the way between the
 * "150" and "160" marks. Numbers may increase or decrease left-to-right
 * in the photo (the ruler could be laid down either way); the calculation
 * is direction-agnostic.
 *
 * This does not require the two numbers to bracket the edge (one on each
 * side) - the nearest two confidently-read numbers *anywhere* nearby are
 * used, even if both fall on the same side. Confirmed necessary against
 * real photos: the sand patch itself sits over the ruler, so the numbers
 * OCR actually manages to read are scattered wherever they happen to be
 * legible, not conveniently placed right next to each detected edge -
 * requiring a strict bracket left every one of several real test photos
 * unmeasured even when the ruler's numbers elsewhere were read cleanly
 * and precisely. Extrapolating a short distance from the closest reliable
 * pair recovers those. `MAX_EXTRAPOLATION_FACTOR` bounds how far past
 * that pair this will reach, since projecting a local scale over a long
 * distance amplifies any perspective distortion or misread far more than
 * interpolating between two points that straddle the edge does.
 */

import type { RulerNumberToken } from "./ocrRuler";
import type { DetectedEdges } from "./autoDetect";

/** Only the geometry readDiameterFromEdges needs - a caller re-expressing edges in a different pixel space (see measurePatch.ts) has no reason to also carry along confidence numbers unchanged. */
type EdgeGeometry = Pick<DetectedEdges, "leftEdgeX" | "rightEdgeX" | "bandCenterY">;

/** Below this OCR confidence (0-100), a recognized digit is too likely to be a misread to anchor a measurement on. */
const MIN_CONFIDENCE = 80;
/**
 * A ruler's own printed numbers are never a bare single digit (the
 * smallest is "0" at one end, then straight to "10", "20"...) - a
 * recognized single digit is stray noise from busy sand/asphalt texture,
 * not a real ruler mark, confirmed directly: on a real photo, a
 * high-confidence stray "4" from the background very nearly bracketed a
 * genuine "100" into a fabricated measurement, passing every other check
 * (confidence, distinct values, plausible implied scale) before this one.
 */
const MIN_RULER_VALUE = 10;
/** Implied local scale outside this pixels-per-mm range indicates a misread digit, not a real ruler marking - wide enough to cover both a close-up macro shot and a wide-angle full-patch shot. */
const MIN_PLAUSIBLE_PX_PER_MM = 0.1;
const MAX_PLAUSIBLE_PX_PER_MM = 50;
/** How far (as a fraction of the photo's height) a ruler number may sit from the scanned band and still count as "on the same line" as the edge - generous, since a ruler has physical width and printed numbers sit somewhere across it, not exactly on the scanned centerline. */
const Y_TOLERANCE_FRACTION = 0.25;
/** How far past the anchor pair this will extrapolate, as a multiple of the pixel distance between them - a small multiple, since projecting a two-point local scale a long way past where it was actually measured is exactly how a lens/perspective quirk or a borderline misread turns into a confidently wrong answer instead of an obviously wrong one. */
const MAX_EXTRAPOLATION_FACTOR = 3;

/**
 * Finds the exact millimetre value at pixel column `edgeX`, using the two
 * recognized ruler numbers nearest to it (within `maxYDistance` of
 * `lineY`) and interpolating or extrapolating linearly between them - see
 * this file's header for why a strict bracket (one on each side) isn't
 * required. Returns null - never a guess - when fewer than two numbers
 * were read nearby, when the two nearest show the same printed value
 * (nothing to project a scale from), when their implied local scale is
 * implausible (a strong sign at least one is a misread), or when `edgeX`
 * is more than `MAX_EXTRAPOLATION_FACTOR` times their own separation
 * beyond them.
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
      t.value >= MIN_RULER_VALUE &&
      Number.isFinite(t.value) &&
      Number.isFinite(t.x) &&
      Number.isFinite(t.y) &&
      Math.abs(t.y - lineY) <= maxYDistance,
  );
  if (candidates.length === 0) return null;

  const byDistanceToEdge = candidates.slice().sort((a, b) => Math.abs(a.x - edgeX) - Math.abs(b.x - edgeX));
  const anchor = byDistanceToEdge[0];
  if (anchor.x === edgeX) return anchor.value;

  const partner = byDistanceToEdge.slice(1).find((t) => t.value !== anchor.value && t.x !== anchor.x);
  if (!partner) return null;

  const [left, right] = anchor.x < partner.x ? [anchor, partner] : [partner, anchor];
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

  const extrapolationDistance = Math.max(0, left.x - edgeX, edgeX - right.x);
  if (extrapolationDistance > pixelSpan * MAX_EXTRAPOLATION_FACTOR) return null;

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
