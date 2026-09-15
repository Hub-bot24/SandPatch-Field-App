import { describe, expect, it } from "vitest";
import { detectPatchDiameter, type GrayscaleImage } from "@/lib/measurement/autoDetect";

/** A width x height image: `background` on both sides, `foreground` in the middle band [patchStart, patchEnd), uniform down every column (so the horizontal centerline profile is the same regardless of exactly which rows are sampled). */
function stepEdgeImage(
  width: number,
  height: number,
  patchStart: number,
  patchEnd: number,
  foreground = 220,
  background = 30,
): GrayscaleImage {
  const data = new Uint8ClampedArray(width * height).fill(background);
  for (let y = 0; y < height; y++) {
    for (let x = patchStart; x < patchEnd; x++) {
      data[y * width + x] = foreground;
    }
  }
  return { width, height, data };
}

/**
 * Same idea, but each edge fades gradually over `rampWidth` columns instead
 * of stepping instantly - simulating a real, not-perfectly-sharp sand
 * boundary. Each ramp is centred ON patchStart/patchEnd (half the ramp
 * inside the patch, half outside) rather than sitting entirely to one
 * side, so the transition's midpoint - where a steepest-gradient detector
 * is expected to land - coincides with the nominal boundary. A ramp placed
 * entirely outside the boundary would make that midpoint several pixels
 * away from patchStart/patchEnd by construction, which would be a flaw in
 * the fixture, not in the detector.
 */
function fuzzyEdgeImage(
  width: number,
  height: number,
  patchStart: number,
  patchEnd: number,
  rampWidth: number,
  foreground = 220,
  background = 30,
): GrayscaleImage {
  const data = new Uint8ClampedArray(width * height).fill(background);
  const halfRamp = rampWidth / 2;
  const valueAt = (x: number): number => {
    if (x < patchStart - halfRamp || x >= patchEnd + halfRamp) return background;
    if (x >= patchStart + halfRamp && x < patchEnd - halfRamp) return foreground;
    if (x < patchStart + halfRamp) {
      const t = (x - (patchStart - halfRamp)) / rampWidth;
      return background + t * (foreground - background);
    }
    const t = 1 - (x - (patchEnd - halfRamp)) / rampWidth;
    return background + t * (foreground - background);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.round(valueAt(x));
    }
  }
  return { width, height, data };
}

describe("detectPatchDiameter", () => {
  it("measures a clean, sharp-edged patch precisely", () => {
    const image = stepEdgeImage(300, 100, 100, 220);
    const result = detectPatchDiameter(image, 1);
    expect(result).not.toBeNull();
    // The left edge lands on the last background column before the step up
    // (index patchStart - 1) and the right edge on the last foreground
    // column before the step down (index patchEnd - 1); their difference
    // still equals the true patch width (patchEnd - patchStart = 120).
    expect(result?.diameterMm).toBeCloseTo(120, 0);
    expect(result?.confidence).toBeGreaterThan(0.8);
  });

  it("still finds the correct edges through a gradual (fuzzy) transition", () => {
    const image = fuzzyEdgeImage(300, 100, 100, 220, 15);
    const result = detectPatchDiameter(image, 1);
    expect(result).not.toBeNull();
    // The steepest-change point of a linear ramp is at its midpoint, so
    // the detected edges should land close to the true boundary despite
    // the fade, not drift toward one end of the ramp.
    expect(result?.diameterMm).toBeGreaterThan(115);
    expect(result?.diameterMm).toBeLessThan(125);
  });

  it("converts pixels to mm using the calibration ratio", () => {
    const image = stepEdgeImage(300, 100, 100, 220);
    const atOnePxPerMm = detectPatchDiameter(image, 1);
    const atTwoPxPerMm = detectPatchDiameter(image, 2);
    expect(atOnePxPerMm).not.toBeNull();
    expect(atTwoPxPerMm).not.toBeNull();
    expect(atTwoPxPerMm!.diameterMm).toBeCloseTo(atOnePxPerMm!.diameterMm / 2, 5);
  });

  it("gives a sharp step edge higher confidence than a gradual one", () => {
    const sharp = detectPatchDiameter(stepEdgeImage(300, 100, 100, 220), 1);
    const fuzzy = detectPatchDiameter(fuzzyEdgeImage(300, 100, 100, 220, 25), 1);
    expect(sharp).not.toBeNull();
    expect(fuzzy).not.toBeNull();
    expect(fuzzy!.confidence).toBeLessThan(sharp!.confidence);
  });

  it("returns null for a uniform image with no edges at all", () => {
    const data = new Uint8ClampedArray(200 * 50).fill(128);
    expect(detectPatchDiameter({ width: 200, height: 50, data }, 1)).toBeNull();
  });

  it("returns null when the only brightness change is too small to trust as a real edge", () => {
    // A 2-level difference is well under MIN_EDGE_MAGNITUDE - JPEG noise territory, not a real boundary.
    const image = stepEdgeImage(300, 100, 100, 220, 102, 100);
    expect(detectPatchDiameter(image, 1)).toBeNull();
  });

  it("returns null for a non-positive calibration ratio instead of dividing by zero", () => {
    const image = stepEdgeImage(300, 100, 100, 220);
    expect(detectPatchDiameter(image, 0)).toBeNull();
    expect(detectPatchDiameter(image, -1)).toBeNull();
  });

  it("returns null for an image too narrow to have two distinct halves", () => {
    const data = new Uint8ClampedArray(3 * 10).fill(128);
    expect(detectPatchDiameter({ width: 3, height: 10, data }, 1)).toBeNull();
  });
});
