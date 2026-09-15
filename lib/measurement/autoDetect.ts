/**
 * Automatic sand-patch diameter detection: no taps, no per-photo
 * calibration. Finds the patch by contrast against the surrounding
 * pavement (Otsu's method - a standard, deterministic thresholding
 * algorithm, not a guess) and measures the resulting region.
 *
 * This still needs exactly one real-world reference to convert pixels to
 * millimetres - a photo alone can never carry an absolute scale, only a
 * ruler or a known camera-to-ground distance can. That reference is
 * `pixelsPerMm`, established once during camera calibration (see
 * types/job.ts's `pixelsPerMm` and the Job Setup calibration flow) and
 * reused for every photo afterwards - never re-derived per photo, and
 * never invented when it's missing (`detectPatchDiameter` requires it).
 *
 * This assumes the patch is lighter than the surrounding pavement (true
 * for sand on a typical bitumen/asphalt seal) and reasonably centred in
 * frame - see the module's known limitations in README.md. It is real
 * image segmentation, with real failure modes (poor contrast, harsh
 * shadows, an off-centre or very close-up shot), not a black box: every
 * result carries a `confidence` derived from how cleanly one region
 * separated out, so a bad read is visibly flagged rather than hidden.
 */

export interface GrayscaleImage {
  width: number;
  height: number;
  /** Row-major grayscale intensities, 0-255, length === width * height. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface AutoDetectResult {
  diameterMm: number;
  diameterPixels: number;
  areaPixels: number;
  /** 0-1: how cleanly a single, roughly circular, centrally-placed region separated out. Not a hard gate - always inspect the number, never silently discarded. */
  confidence: number;
}

interface Component {
  area: number;
  centroidX: number;
  centroidY: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Standard Otsu threshold: the intensity (0-255) that best splits the histogram into two populations by maximizing between-class variance. */
export function computeOtsuThreshold(histogram: number[], totalPixels: number): number {
  if (totalPixels === 0) return 128;

  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumForeground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let bestThreshold = 0;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumForeground += t * histogram[t];
    const meanBackground = sumForeground / weightBackground;
    const meanForeground = (sumAll - sumForeground) / weightForeground;
    const meanDiff = meanBackground - meanForeground;
    const variance = weightBackground * weightForeground * meanDiff * meanDiff;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

export function buildHistogram(image: GrayscaleImage): number[] {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < image.data.length; i++) {
    histogram[image.data[i]]++;
  }
  return histogram;
}

/**
 * Finds every connected region (8-connectivity) of pixels on the
 * `foregroundIsBrighter` side of `threshold`, using an explicit-stack
 * flood fill (never recursive - a recursive fill would blow the call
 * stack on a large contiguous region, which a real sand patch photo
 * produces routinely).
 */
function findComponents(image: GrayscaleImage, threshold: number, foregroundIsBrighter: boolean): Component[] {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  const stack: number[] = [];

  const isForeground = (index: number) => (foregroundIsBrighter ? data[index] > threshold : data[index] < threshold);

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || !isForeground(start)) continue;

    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index / width) | 0;

      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIndex = ny * width + nx;
          if (visited[nIndex] || !isForeground(nIndex)) continue;
          visited[nIndex] = 1;
          stack.push(nIndex);
        }
      }
    }

    components.push({
      area,
      centroidX: sumX / area,
      centroidY: sumY / area,
      boundingBox: { minX, minY, maxX, maxY },
    });
  }

  return components;
}

/** Prefers a component centred within the middle 70% of the frame (avoids a bright sky corner or lens flare); falls back to the single largest region overall rather than returning nothing. */
function pickPatchComponent(components: Component[], width: number, height: number): Component | null {
  if (components.length === 0) return null;

  const centralMarginX = width * 0.15;
  const centralMarginY = height * 0.15;
  const central = components.filter(
    (c) =>
      c.centroidX >= centralMarginX &&
      c.centroidX <= width - centralMarginX &&
      c.centroidY >= centralMarginY &&
      c.centroidY <= height - centralMarginY,
  );

  const pool = central.length > 0 ? central : components;
  return pool.reduce((largest, c) => (c.area > largest.area ? c : largest));
}

/** How cleanly `component` resembles a single filled circle: 1.0 for a perfect circle, lower for an irregular/fragmented/off-centre region. Purely informational - never gates the result. */
function estimateConfidence(component: Component, width: number, height: number): number {
  const boxWidth = component.boundingBox.maxX - component.boundingBox.minX + 1;
  const boxHeight = component.boundingBox.maxY - component.boundingBox.minY + 1;
  const boxArea = boxWidth * boxHeight;
  // A filled circle occupies about pi/4 (~0.785) of its bounding square.
  const fillRatio = boxArea > 0 ? component.area / boxArea : 0;
  const circularityScore = Math.max(0, 1 - Math.abs(fillRatio - Math.PI / 4) / (Math.PI / 4));

  const centerX = width / 2;
  const centerY = height / 2;
  const maxOffset = Math.hypot(width, height) / 2;
  const offset = Math.hypot(component.centroidX - centerX, component.centroidY - centerY);
  const centralityScore = maxOffset > 0 ? Math.max(0, 1 - offset / maxOffset) : 1;

  return Math.max(0, Math.min(1, circularityScore * 0.7 + centralityScore * 0.3));
}

/**
 * Detects the sand patch in `image` and returns its diameter in mm using
 * `pixelsPerMm` (from a one-time camera calibration - see the module doc
 * comment). Returns null only when no foreground region exists at all
 * (e.g. a blank or fully uniform photo) - any other result, however
 * unreliable-looking, is still returned with a low `confidence` rather
 * than silently discarded, so the operator can see and correct it.
 */
export function detectPatchDiameter(
  image: GrayscaleImage,
  pixelsPerMm: number,
  foregroundIsBrighter = true,
): AutoDetectResult | null {
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return null;

  const histogram = buildHistogram(image);
  const threshold = computeOtsuThreshold(histogram, image.width * image.height);
  const components = findComponents(image, threshold, foregroundIsBrighter);
  const patch = pickPatchComponent(components, image.width, image.height);
  if (!patch) return null;

  // A real patch, properly framed, never fills basically the whole photo -
  // there is always some pavement/background visible around it. A region
  // this large means the photo had no real contrast to threshold (e.g. a
  // blank or overexposed frame), not an actual detection, and Otsu's
  // threshold degenerates to the histogram's edge in exactly that case.
  const totalPixels = image.width * image.height;
  if (patch.area > totalPixels * 0.9) return null;

  const diameterPixels = 2 * Math.sqrt(patch.area / Math.PI);
  const diameterMm = diameterPixels / pixelsPerMm;
  const confidence = estimateConfidence(patch, image.width, image.height);

  return { diameterMm, diameterPixels, areaPixels: patch.area, confidence };
}
