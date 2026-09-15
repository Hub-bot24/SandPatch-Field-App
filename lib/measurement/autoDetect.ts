/**
 * Automatic sand-patch edge detection: finds the patch's two edges along
 * the photo's horizontal centerline, the same way a physical ruler laid
 * across the patch would be read - rather than the overall size of the
 * visible sand shape. This distinction matters: the real field method
 * takes four separate readings at four different angles specifically to
 * catch a patch that isn't perfectly round, and measuring "the whole
 * shape's size" the same way regardless of angle would silently defeat
 * the purpose of those four separate readings.
 *
 * Each edge along that line is found at its point of steepest contrast
 * change (the discrete derivative's peak), not a single fixed brightness
 * threshold - a real sand edge is often a gradual fade rather than a hard
 * line, and the steepest-change point is a well-defined, repeatable
 * target on a gradual transition in a way an arbitrary brightness cutoff
 * isn't. This mirrors, digitally, the same problem a second ruler solves
 * by hand at a fuzzy edge: turning an inherently unclear boundary into
 * one specific, exact point to read.
 *
 * This module only ever reports *pixel* positions - it has no way to
 * convert those to millimetres itself, since a photo alone can never
 * carry an absolute scale. That conversion happens per photo, by reading
 * the ruler's own printed numbers right at each edge (see
 * lib/measurement/readRulerAtEdge.ts and lib/measurement/measurePatch.ts),
 * not by any calibration stored here or reused across photos.
 */

export interface GrayscaleImage {
  width: number;
  height: number;
  /** Row-major grayscale intensities, 0-255, length === width * height. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface DetectedEdges {
  leftEdgeX: number;
  rightEdgeX: number;
  /** Vertical centre (in `image`'s pixel space) of the horizontal band that was scanned - the line a ruler laid across the patch is expected to run along. */
  bandCenterY: number;
  /** 0-1 each: how sharply that edge stood out against the background noise level. Not a hard gate - always inspect the number, never silently discarded. */
  leftConfidence: number;
  rightConfidence: number;
}

/** Fraction of the image's height averaged into the horizontal profile, centred vertically - smooths sand-grain/JPEG noise without requiring the whole frame to be part of the patch. */
const BAND_FRACTION = 0.16;
/** Minimum brightness change (0-255 scale) between adjacent columns to trust as a real edge rather than noise. */
const MIN_EDGE_MAGNITUDE = 6;

/** Averages a horizontal band of rows, centred vertically, into one brightness value per column. */
function buildHorizontalProfile(image: GrayscaleImage): number[] {
  const { width, height, data } = image;
  const bandHeight = Math.max(1, Math.round(height * BAND_FRACTION));
  const bandStart = Math.max(0, Math.floor((height - bandHeight) / 2));
  const bandEnd = Math.min(height, bandStart + bandHeight);
  const rowCount = bandEnd - bandStart;

  const profile = new Array<number>(width).fill(0);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = bandStart; y < bandEnd; y++) {
      sum += data[y * width + x];
    }
    profile[x] = sum / rowCount;
  }
  return profile;
}

interface EdgePeak {
  index: number;
  magnitude: number;
  meanMagnitude: number;
}

/** Near-equal gradient magnitudes (within this many grayscale levels) are treated as one plateau rather than distinct peaks - see findSteepestEdge. */
const PLATEAU_TOLERANCE = 0.5;

/**
 * Finds the steepest brightness change within profile[start, end). A hard
 * step has one clear peak; a gradual (near-linear) transition instead
 * produces a plateau of tied-magnitude columns spanning the whole
 * transition, so this takes the midpoint of that plateau rather than its
 * first column - otherwise the detected edge would drift toward whichever
 * end of a fuzzy transition the scan direction reaches first, rather than
 * landing on the transition's actual centre.
 */
function findSteepestEdge(profile: number[], start: number, end: number): EdgePeak | null {
  if (end - start < 2) return null;

  const magnitudes: number[] = [];
  let peakMagnitude = -1;
  for (let x = start; x < end - 1; x++) {
    const magnitude = Math.abs(profile[x + 1] - profile[x]);
    magnitudes.push(magnitude);
    if (magnitude > peakMagnitude) peakMagnitude = magnitude;
  }
  if (peakMagnitude <= 0) return null;

  let firstPeakOffset = -1;
  let lastPeakOffset = -1;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] >= peakMagnitude - PLATEAU_TOLERANCE) {
      if (firstPeakOffset === -1) firstPeakOffset = i;
      lastPeakOffset = i;
    }
  }

  const index = start + Math.round((firstPeakOffset + lastPeakOffset) / 2);
  const magnitudeSum = magnitudes.reduce((sum, m) => sum + m, 0);
  return { index, magnitude: peakMagnitude, meanMagnitude: magnitudeSum / magnitudes.length };
}

/** How far a peak stands out above the typical column-to-column change elsewhere on its side - a lone sharp edge scores near 1, a peak barely bigger than the surrounding noise scores near 0. */
function edgeConfidence(peak: EdgePeak): number {
  if (peak.magnitude <= 0) return 0;
  const ratio = (peak.magnitude - peak.meanMagnitude) / peak.magnitude;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Detects the sand patch's two edges along `image`'s horizontal
 * centerline, in `image`'s own pixel coordinates. Returns null when
 * either side has no edge clear enough to trust (a blank/uniform photo,
 * a change too small to be more than noise, or the two sides disagreeing
 * on which is left/right) - any other result, however unreliable-looking,
 * is still returned with a low `confidence` rather than silently
 * discarded, so the operator can see and correct it.
 *
 * Converting these pixel positions to a millimetre diameter is a
 * separate step (lib/measurement/measurePatch.ts) that reads the ruler's
 * own printed numbers right at each edge - this function knows nothing
 * about millimetres at all.
 */
export function detectPatchEdges(image: GrayscaleImage): DetectedEdges | null {
  if (image.width < 4) return null;

  const profile = buildHorizontalProfile(image);
  const mid = Math.floor(profile.length / 2);

  const leftPeak = findSteepestEdge(profile, 0, mid);
  const rightPeak = findSteepestEdge(profile, mid, profile.length);
  if (!leftPeak || !rightPeak) return null;
  if (leftPeak.magnitude < MIN_EDGE_MAGNITUDE || rightPeak.magnitude < MIN_EDGE_MAGNITUDE) return null;
  if (rightPeak.index <= leftPeak.index) return null;

  const { height } = image;
  const bandHeight = Math.max(1, Math.round(height * BAND_FRACTION));
  const bandStart = Math.max(0, Math.floor((height - bandHeight) / 2));

  return {
    leftEdgeX: leftPeak.index,
    rightEdgeX: rightPeak.index,
    bandCenterY: bandStart + bandHeight / 2,
    leftConfidence: edgeConfidence(leftPeak),
    rightConfidence: edgeConfidence(rightPeak),
  };
}
