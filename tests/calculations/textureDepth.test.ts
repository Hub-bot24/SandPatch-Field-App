import { describe, expect, it } from "vitest";
import { calculateAverageDiameter, calculateTextureDepth } from "@/lib/calculations/textureDepth";

describe("calculateAverageDiameter", () => {
  it("returns the mean of four valid diameters", () => {
    expect(calculateAverageDiameter(240, 245, 238, 242)).toBeCloseTo(241.25, 6);
  });

  it("returns null if any diameter is missing", () => {
    expect(calculateAverageDiameter(240, 245, 238, null)).toBeNull();
    expect(calculateAverageDiameter(undefined, 245, 238, 242)).toBeNull();
  });

  it("returns null if any diameter is not finite", () => {
    expect(calculateAverageDiameter(240, 245, 238, Number.NaN)).toBeNull();
  });

  it("returns null if any diameter is zero or negative", () => {
    expect(calculateAverageDiameter(240, 0, 238, 242)).toBeNull();
    expect(calculateAverageDiameter(240, -5, 238, 242)).toBeNull();
  });
});

describe("calculateTextureDepth", () => {
  it("matches the worked example from the field spec: 240/245/238/242mm @ 50mL ~= 1.09mm", () => {
    const average = calculateAverageDiameter(240, 245, 238, 242);
    expect(average).toBeCloseTo(241.25, 6);

    const textureDepth = calculateTextureDepth(average, 50);
    expect(textureDepth).not.toBeNull();
    expect(textureDepth as number).toBeCloseTo(1.0938, 3);
    expect((textureDepth as number).toFixed(2)).toBe("1.09");
  });

  it("implements TD = (4 x V x 1000) / (pi x D^2) exactly", () => {
    const textureDepth = calculateTextureDepth(200, 100);
    const expected = (4 * 100 * 1000) / (Math.PI * 200 * 200);
    expect(textureDepth).toBeCloseTo(expected, 9);
  });

  it("returns null when average diameter is null", () => {
    expect(calculateTextureDepth(null, 50)).toBeNull();
  });

  it("returns null when sand volume is not positive", () => {
    expect(calculateTextureDepth(200, 0)).toBeNull();
    expect(calculateTextureDepth(200, -50)).toBeNull();
  });
});
