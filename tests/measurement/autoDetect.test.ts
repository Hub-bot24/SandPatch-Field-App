import { describe, expect, it } from "vitest";
import { detectPatchEdges, type GrayscaleImage } from "@/lib/measurement/autoDetect";

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
 * is expected to land - coincides with the nominal boundary.
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

describe("detectPatchEdges", () => {
  it("finds both edges of a clean, sharp-edged patch precisely", () => {
    const image = stepEdgeImage(300, 100, 100, 220);
    const result = detectPatchEdges(image);
    expect(result).not.toBeNull();
    // The left edge lands on the last background column before the step up
    // (index patchStart - 1) and the right edge on the last foreground
    // column before the step down (index patchEnd - 1).
    expect(result?.leftEdgeX).toBe(99);
    expect(result?.rightEdgeX).toBe(219);
    expect(result?.leftConfidence).toBeGreaterThan(0.8);
    expect(result?.rightConfidence).toBeGreaterThan(0.8);
  });

  it("reports the vertical centre of the scanned band", () => {
    const image = stepEdgeImage(300, 100, 100, 220);
    const result = detectPatchEdges(image);
    expect(result).not.toBeNull();
    // height=100, BAND_FRACTION=0.16 -> a centred ~16px band, so the
    // reported centre should sit close to the image's own vertical middle.
    expect(result?.bandCenterY).toBeGreaterThan(40);
    expect(result?.bandCenterY).toBeLessThan(60);
  });

  it("still finds edges close to the true boundary through a gradual (fuzzy) transition", () => {
    const image = fuzzyEdgeImage(300, 100, 100, 220, 15);
    const result = detectPatchEdges(image);
    expect(result).not.toBeNull();
    // The steepest-change point of a linear ramp is at its midpoint, which
    // here is centred on the true boundary - so the edges should land
    // close to 100 and 220 despite the fade, not drift toward one end.
    expect(result?.leftEdgeX).toBeGreaterThan(90);
    expect(result?.leftEdgeX).toBeLessThan(105);
    expect(result?.rightEdgeX).toBeGreaterThan(215);
    expect(result?.rightEdgeX).toBeLessThan(230);
  });

  it("gives a sharp step edge higher confidence than a gradual one", () => {
    const sharp = detectPatchEdges(stepEdgeImage(300, 100, 100, 220));
    const fuzzy = detectPatchEdges(fuzzyEdgeImage(300, 100, 100, 220, 25));
    expect(sharp).not.toBeNull();
    expect(fuzzy).not.toBeNull();
    const sharpConfidence = Math.min(sharp!.leftConfidence, sharp!.rightConfidence);
    const fuzzyConfidence = Math.min(fuzzy!.leftConfidence, fuzzy!.rightConfidence);
    expect(fuzzyConfidence).toBeLessThan(sharpConfidence);
  });

  it("returns null for a uniform image with no edges at all", () => {
    const data = new Uint8ClampedArray(200 * 50).fill(128);
    expect(detectPatchEdges({ width: 200, height: 50, data })).toBeNull();
  });

  it("returns null when the only brightness change is too small to trust as a real edge", () => {
    // A 2-level difference is well under MIN_EDGE_MAGNITUDE - JPEG noise territory, not a real boundary.
    const image = stepEdgeImage(300, 100, 100, 220, 102, 100);
    expect(detectPatchEdges(image)).toBeNull();
  });

  it("returns null for an image too narrow to have two distinct halves", () => {
    const data = new Uint8ClampedArray(3 * 10).fill(128);
    expect(detectPatchEdges({ width: 3, height: 10, data })).toBeNull();
  });
});
