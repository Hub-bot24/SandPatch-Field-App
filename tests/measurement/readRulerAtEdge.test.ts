import { describe, expect, it } from "vitest";
import { readDiameterFromEdges, readMmAtEdge } from "@/lib/measurement/readRulerAtEdge";
import type { RulerNumberToken } from "@/lib/measurement/ocrRuler";

const LINE_Y = 50;
const Y_TOLERANCE = 20;

function token(value: number, x: number, y = LINE_Y, confidence = 95): RulerNumberToken {
  return { value, x, y, confidence };
}

/** Ascending ruler: 10, 20, 30, 40, 50 at x = value * 3 (3px/mm), all on LINE_Y. */
const ASCENDING: RulerNumberToken[] = [10, 20, 30, 40, 50].map((v) => token(v, v * 3));

describe("readMmAtEdge", () => {
  it("interpolates linearly between the two numbers bracketing the edge", () => {
    // Between 20@x60 and 30@x90, halfway across -> 25mm.
    expect(readMmAtEdge(ASCENDING, 75, LINE_Y, Y_TOLERANCE)).toBeCloseTo(25, 6);
  });

  it("interpolates correctly when the ruler's numbers decrease left-to-right", () => {
    const descending = [50, 40, 30, 20, 10].map((v, i) => token(v, [30, 60, 90, 120, 150][i]));
    // Between 40@x60 and 30@x90, halfway across -> 35mm.
    expect(readMmAtEdge(descending, 75, LINE_Y, Y_TOLERANCE)).toBeCloseTo(35, 6);
  });

  it("returns the number's own value when the edge lands exactly on it", () => {
    expect(readMmAtEdge(ASCENDING, 60, LINE_Y, Y_TOLERANCE)).toBe(20);
  });

  it("returns null when the edge is beyond every recognized number on one side", () => {
    expect(readMmAtEdge(ASCENDING, 500, LINE_Y, Y_TOLERANCE)).toBeNull();
    expect(readMmAtEdge(ASCENDING, -500, LINE_Y, Y_TOLERANCE)).toBeNull();
  });

  it("ignores a low-confidence number even if it would otherwise bracket more tightly", () => {
    const tokens = [...ASCENDING, token(999, 75, LINE_Y, 50)];
    // The low-confidence 999@x75 sits exactly on the edge and would
    // otherwise be returned directly (left === right) - excluding it
    // should fall back to the real 20@x60 / 30@x90 pair instead.
    expect(readMmAtEdge(tokens, 75, LINE_Y, Y_TOLERANCE)).toBeCloseTo(25, 6);
  });

  it("ignores a number far from the scanned line even if its position would bracket tightly", () => {
    const tokens = [...ASCENDING, token(999, 75, 500, 95)];
    expect(readMmAtEdge(tokens, 75, LINE_Y, Y_TOLERANCE)).toBeCloseTo(25, 6);
  });

  it("returns null when the nearest pair's implied scale is implausible (a likely misread)", () => {
    // 2px apart claiming a 490mm difference -> ~0.004 px/mm, far outside plausible range.
    const tokens = [token(10, 74), token(500, 76)];
    expect(readMmAtEdge(tokens, 75, LINE_Y, Y_TOLERANCE)).toBeNull();
  });

  it("extrapolates from the nearest pair when both fall on the same side of the edge", () => {
    // Confirmed necessary against a real photo: the two numbers OCR
    // actually read were both well to one side of the detected edge,
    // with nothing legible bracketing it directly.
    const tokens = [token(29, 337), token(100, 825)];
    // Scale: (825-337)/(100-29) = 6.873px/mm. At edgeX=206 (left of both,
    // within the 3x extrapolation cap): 29 + (206-337)/6.873 ~= 9.9mm.
    expect(readMmAtEdge(tokens, 206, LINE_Y, Y_TOLERANCE)).toBeCloseTo(9.94, 1);
  });

  it("returns null when the edge is past the extrapolation cap for the nearest pair", () => {
    // Same real-scale pair as above, but placed 4x their own separation
    // past the nearer one - beyond MAX_EXTRAPOLATION_FACTOR (3x).
    const tokens = [token(29, 337), token(100, 825)];
    expect(readMmAtEdge(tokens, 337 - 488 * 4, LINE_Y, Y_TOLERANCE)).toBeNull();
  });

  it("ignores a single-digit number even at high confidence with an otherwise-plausible bracket", () => {
    // A stray "4" from background texture, confirmed against a real photo:
    // high confidence, a plausible implied scale against the genuine 100,
    // and it would otherwise have produced a fabricated measurement.
    const tokens = [token(100, 60), token(4, 90)];
    expect(readMmAtEdge(tokens, 75, LINE_Y, Y_TOLERANCE)).toBeNull();
  });

  it("returns null when both bracketing numbers show the same value (nothing to interpolate)", () => {
    const tokens = [token(20, 60), token(20, 90)];
    expect(readMmAtEdge(tokens, 75, LINE_Y, Y_TOLERANCE)).toBeNull();
  });

  it("returns null when there are no candidate numbers at all", () => {
    expect(readMmAtEdge([], 75, LINE_Y, Y_TOLERANCE)).toBeNull();
  });
});

describe("readDiameterFromEdges", () => {
  it("reads both edges and returns the diameter between them", () => {
    // left=25mm (between 20@60/30@90), right=45mm (between 40@120/50@150) -> 20mm apart.
    const result = readDiameterFromEdges(ASCENDING, { leftEdgeX: 75, rightEdgeX: 135, bandCenterY: LINE_Y }, 200);
    expect(result).toBeCloseTo(20, 6);
  });

  it("returns null when either edge can't be read confidently", () => {
    const result = readDiameterFromEdges(ASCENDING, { leftEdgeX: 75, rightEdgeX: 5000, bandCenterY: LINE_Y }, 200);
    expect(result).toBeNull();
  });

  it("returns null rather than a zero diameter when both edges resolve to the same point", () => {
    const result = readDiameterFromEdges(ASCENDING, { leftEdgeX: 60, rightEdgeX: 60, bandCenterY: LINE_Y }, 200);
    expect(result).toBeNull();
  });
});
