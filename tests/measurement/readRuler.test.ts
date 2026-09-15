import { describe, expect, it } from "vitest";
import { estimatePixelsPerMmFromRulerNumbers, type RulerNumberToken } from "@/lib/measurement/readRuler";

/** Evenly-spaced ruler marks along a horizontal line at a fixed pixels-per-mm scale, all high-confidence. */
function rulerTokens(values: number[], pixelsPerMm: number, startX = 0, y = 500): RulerNumberToken[] {
  return values.map((value) => ({
    value,
    x: startX + value * pixelsPerMm,
    y,
    confidence: 95,
  }));
}

describe("estimatePixelsPerMmFromRulerNumbers", () => {
  it("finds the scale from a clean set of evenly-spaced ruler numbers", () => {
    const tokens = rulerTokens([150, 160, 170, 180, 190, 200, 210, 220, 230], 2.5);
    const result = estimatePixelsPerMmFromRulerNumbers(tokens);
    expect(result).not.toBeNull();
    expect(result?.pixelsPerMm).toBeCloseTo(2.5, 6);
    // 9 numbers -> C(9,2) = 36 pairs, all mutually consistent.
    expect(result?.supportingPairs).toBe(36);
  });

  it("ignores a handful of high-confidence but unrelated noise tokens (from background texture)", () => {
    const realRuler = rulerTokens([150, 160, 170, 180, 190, 200, 210, 220, 230], 2.5);
    const noise: RulerNumberToken[] = [
      { value: 4, x: 20, y: 889, confidence: 83 },
      { value: 2, x: 411, y: 892, confidence: 84 },
      { value: 2, x: 459, y: 1169, confidence: 88 },
      { value: 4, x: 1673, y: 2451, confidence: 89 },
    ];
    const result = estimatePixelsPerMmFromRulerNumbers([...realRuler, ...noise]);
    expect(result).not.toBeNull();
    expect(result?.pixelsPerMm).toBeCloseTo(2.5, 6);
  });

  it("filters out low-confidence tokens even if they would otherwise agree", () => {
    const highConfidence = rulerTokens([150, 160, 170], 2.5);
    const lowConfidence: RulerNumberToken[] = [
      { value: 180, x: 450, y: 500, confidence: 40 },
      { value: 190, x: 475, y: 500, confidence: 55 },
    ];
    const result = estimatePixelsPerMmFromRulerNumbers([...highConfidence, ...lowConfidence]);
    // Only 3 high-confidence tokens -> exactly 3 pairs, right at the minimum.
    expect(result).not.toBeNull();
    expect(result?.totalPairs).toBe(3);
  });

  it("returns null when there are too few tokens to form enough agreeing pairs", () => {
    const tokens = rulerTokens([150, 230], 2.5); // only 1 pair possible
    expect(estimatePixelsPerMmFromRulerNumbers(tokens)).toBeNull();
  });

  it("returns null for entirely inconsistent (random) high-confidence numbers", () => {
    const tokens: RulerNumberToken[] = [
      { value: 4, x: 20, y: 889, confidence: 90 },
      { value: 2, x: 411, y: 892, confidence: 90 },
      { value: 2, x: 459, y: 1169, confidence: 90 },
      { value: 4, x: 1673, y: 2451, confidence: 90 },
      { value: 9, x: 780, y: 2016, confidence: 90 },
    ];
    expect(estimatePixelsPerMmFromRulerNumbers(tokens)).toBeNull();
  });

  it("returns null for an empty token list", () => {
    expect(estimatePixelsPerMmFromRulerNumbers([])).toBeNull();
  });

  it("ignores pairs of identically-valued tokens (division by zero guard)", () => {
    const tokens: RulerNumberToken[] = [
      { value: 150, x: 100, y: 500, confidence: 95 },
      { value: 150, x: 105, y: 500, confidence: 95 }, // same value, different position - meaningless pair
      { value: 230, x: 300, y: 500, confidence: 95 },
    ];
    // Only the two (150,230) pairs are usable; still below the minimum of 3.
    expect(estimatePixelsPerMmFromRulerNumbers(tokens)).toBeNull();
  });

  it("rejects an implausible implied scale (e.g. two unrelated digits from a tiny background artifact)", () => {
    const realRuler = rulerTokens([150, 160, 170, 180], 2.5);
    // A pair 1px apart claiming to represent a 40mm difference -> 0.025 px/mm, outside plausible range.
    const implausible: RulerNumberToken[] = [
      { value: 5, x: 900, y: 900, confidence: 95 },
      { value: 45, x: 901, y: 900, confidence: 95 },
    ];
    const result = estimatePixelsPerMmFromRulerNumbers([...realRuler, ...implausible]);
    expect(result).not.toBeNull();
    expect(result?.pixelsPerMm).toBeCloseTo(2.5, 6);
  });
});
