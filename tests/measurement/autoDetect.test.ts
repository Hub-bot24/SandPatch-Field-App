import { describe, expect, it } from "vitest";
import {
  buildHistogram,
  computeOtsuThreshold,
  detectPatchDiameter,
  type GrayscaleImage,
} from "@/lib/measurement/autoDetect";

/** A width x height grayscale image, `background` everywhere except a filled circle of `foreground` centred at (cx, cy) with the given radius. */
function circleImage(
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  foreground = 220,
  background = 30,
): GrayscaleImage {
  const data = new Uint8ClampedArray(width * height).fill(background);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        data[y * width + x] = foreground;
      }
    }
  }
  return { width, height, data };
}

describe("computeOtsuThreshold", () => {
  it("splits a clearly bimodal histogram between the two populations", () => {
    const histogram = new Array(256).fill(0);
    // A small spread around each population (rather than single-value
    // spikes) so there's a real gap for the threshold to land inside,
    // rather than exactly on one population's own edge.
    for (let v = 25; v <= 35; v++) histogram[v] = 50; // background population
    for (let v = 215; v <= 225; v++) histogram[v] = 50; // foreground population
    const threshold = computeOtsuThreshold(histogram, 1100);
    // Between-class variance is maximized by any threshold in the gap
    // (36-214) - this implementation picks the first such value, a
    // standard, documented convention, not an arbitrary choice.
    expect(threshold).toBeGreaterThanOrEqual(35);
    expect(threshold).toBeLessThanOrEqual(215);
  });

  it("matches buildHistogram's output shape for a real image", () => {
    const image = circleImage(20, 20, 10, 10, 5);
    const histogram = buildHistogram(image);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(400);
  });
});

describe("detectPatchDiameter", () => {
  it("measures a centred circle close to its true diameter", () => {
    const radius = 30;
    const image = circleImage(120, 120, 60, 60, radius);
    const result = detectPatchDiameter(image, /* pixelsPerMm */ 1);
    expect(result).not.toBeNull();
    // Equivalent-circle diameter from pixel area should be close to 2*radius.
    expect(result?.diameterMm).toBeGreaterThan(radius * 2 * 0.9);
    expect(result?.diameterMm).toBeLessThan(radius * 2 * 1.1);
    expect(result?.confidence).toBeGreaterThan(0.7);
  });

  it("converts pixels to mm using the calibration ratio", () => {
    const image = circleImage(120, 120, 60, 60, 30);
    const atOnePxPerMm = detectPatchDiameter(image, 1);
    const atTwoPxPerMm = detectPatchDiameter(image, 2);
    expect(atOnePxPerMm).not.toBeNull();
    expect(atTwoPxPerMm).not.toBeNull();
    // Double the px/mm ratio (a more zoomed-in or higher-res photo) halves the mm reading for the same pixel measurement.
    expect(atTwoPxPerMm!.diameterMm).toBeCloseTo(atOnePxPerMm!.diameterMm / 2, 5);
  });

  it("prefers a centrally-placed region over a larger one stuck in a corner", () => {
    const width = 200;
    const height = 200;
    const data = new Uint8ClampedArray(width * height).fill(30);
    // A large bright blob jammed into the corner (e.g. overexposed sky) - bigger than the real patch.
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) data[y * width + x] = 220;
    }
    // The real, smaller patch, centred.
    const centralRadius = 15;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((x - 100) ** 2 + (y - 100) ** 2 <= centralRadius * centralRadius) {
          data[y * width + x] = 220;
        }
      }
    }
    const result = detectPatchDiameter({ width, height, data }, 1);
    expect(result).not.toBeNull();
    // Should measure the small central patch (~30px diameter), not the larger corner blob (~40px square).
    expect(result?.diameterMm).toBeLessThan(35);
  });

  it("returns null for a uniform image with no contrast to threshold", () => {
    const data = new Uint8ClampedArray(50 * 50).fill(128);
    const result = detectPatchDiameter({ width: 50, height: 50, data }, 1);
    expect(result).toBeNull();
  });

  it("returns null for a non-positive calibration ratio instead of dividing by zero", () => {
    const image = circleImage(60, 60, 30, 30, 10);
    expect(detectPatchDiameter(image, 0)).toBeNull();
    expect(detectPatchDiameter(image, -1)).toBeNull();
  });

  it("gives a lower confidence to an irregular, scattered region than a clean circle", () => {
    const cleanCircle = circleImage(120, 120, 60, 60, 30);
    const cleanResult = detectPatchDiameter(cleanCircle, 1);

    const width = 120;
    const height = 120;
    const scattered = new Uint8ClampedArray(width * height).fill(30);
    // A thin, spread-out irregular shape rather than a filled disc - a jagged
    // "L" shape connects several arms so it counts as one component but
    // fills only a small fraction of its own bounding box.
    for (let x = 20; x < 100; x++) scattered[60 * width + x] = 220;
    for (let y = 20; y < 100; y++) scattered[y * width + 60] = 220;
    const scatteredResult = detectPatchDiameter({ width, height, data: scattered }, 1);

    expect(cleanResult).not.toBeNull();
    expect(scatteredResult).not.toBeNull();
    expect(scatteredResult!.confidence).toBeLessThan(cleanResult!.confidence);
  });
});
