/**
 * Reads a ruler's own printed numbers to establish pixels-per-mm, so
 * camera calibration needs zero taps: take one photo of the ruler and the
 * scale is read directly off it. This is not a guess at "the app can read
 * numbers" - it works by finding many pairs of confidently-recognized
 * digit tokens whose implied scale (pixel distance / difference in their
 * printed values) all agree with each other. Real ruler markings are
 * evenly spaced and collinear, so dozens of pairs among them imply
 * essentially the same scale; a false reading from background texture is
 * effectively random and won't agree with anything, so it's outvoted
 * rather than needing to be identified and filtered individually.
 */

export interface RulerNumberToken {
  /** The recognized number's real value, e.g. 150 for a "150" mark. */
  value: number;
  /** Bounding-box center, in the source image's pixel coordinates. */
  x: number;
  y: number;
  /** OCR-reported confidence, 0-100. */
  confidence: number;
}

export interface RulerReadResult {
  pixelsPerMm: number;
  /** How many token pairs agreed on this scale - higher is stronger evidence. */
  supportingPairs: number;
  /** Total plausible pairs considered, for context on how decisive the match was. */
  totalPairs: number;
}

const MIN_CONFIDENCE = 80;
const MIN_SUPPORTING_PAIRS = 3;
const MIN_PLAUSIBLE_PX_PER_MM = 0.1;
const MAX_PLAUSIBLE_PX_PER_MM = 50;
/** Two pairs "agree" if their implied scales are within this fraction of each other. */
const CLUSTER_TOLERANCE = 0.05;

/**
 * Returns the pixels-per-mm scale most consistently implied by pairs of
 * recognized ruler numbers, or null when there isn't enough agreeing
 * evidence to trust (too few high-confidence tokens, or no consistent
 * pattern among them at all) - callers should fall back to manual
 * calibration rather than accept a low-confidence guess.
 */
export function estimatePixelsPerMmFromRulerNumbers(tokens: RulerNumberToken[]): RulerReadResult | null {
  const candidates = tokens.filter(
    (t) => t.confidence >= MIN_CONFIDENCE && Number.isFinite(t.value) && Number.isFinite(t.x) && Number.isFinite(t.y),
  );

  const impliedScales: number[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const valueDiff = Math.abs(a.value - b.value);
      if (valueDiff === 0) continue;

      const pixelDistance = Math.hypot(a.x - b.x, a.y - b.y);
      const impliedPxPerMm = pixelDistance / valueDiff;
      if (impliedPxPerMm < MIN_PLAUSIBLE_PX_PER_MM || impliedPxPerMm > MAX_PLAUSIBLE_PX_PER_MM) continue;

      impliedScales.push(impliedPxPerMm);
    }
  }

  if (impliedScales.length === 0) return null;

  let bestCluster: number[] = [];
  for (const pivot of impliedScales) {
    const cluster = impliedScales.filter((v) => Math.abs(v - pivot) / pivot <= CLUSTER_TOLERANCE);
    if (cluster.length > bestCluster.length) {
      bestCluster = cluster;
    }
  }

  if (bestCluster.length < MIN_SUPPORTING_PAIRS) return null;

  bestCluster.sort((a, b) => a - b);
  const median = bestCluster[Math.floor(bestCluster.length / 2)];

  return { pixelsPerMm: median, supportingPairs: bestCluster.length, totalPairs: impliedScales.length };
}
