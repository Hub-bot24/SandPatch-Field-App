import { describe, expect, it } from "vitest";
import { formatAverageDiameter, formatChainage, formatTextureDepth } from "@/lib/calculations/format";

describe("formatChainage", () => {
  it("always shows exactly three decimal places", () => {
    expect(formatChainage(27.08)).toBe("27.080");
    expect(formatChainage(27.08)).not.toBe("27.08");
    expect(formatChainage(0)).toBe("0.000");
    expect(formatChainage(5)).toBe("5.000");
    expect(formatChainage(27.0801)).toBe("27.080");
  });

  it("does not round 27.080 down to fewer decimals", () => {
    expect(formatChainage(27.08)).toBe("27.080");
  });

  it("returns a placeholder for null/undefined/NaN", () => {
    expect(formatChainage(null)).toBe("—");
    expect(formatChainage(undefined)).toBe("—");
    expect(formatChainage(Number.NaN)).toBe("—");
  });
});

describe("formatTextureDepth", () => {
  it("shows exactly two decimal places with a unit", () => {
    expect(formatTextureDepth(1.09375)).toBe("1.09 mm");
    expect(formatTextureDepth(1.0951)).toBe("1.10 mm");
  });

  it("returns a placeholder when not available", () => {
    expect(formatTextureDepth(null)).toBe("—");
  });
});

describe("formatAverageDiameter", () => {
  it("shows exactly two decimal places with a unit", () => {
    expect(formatAverageDiameter(241.25)).toBe("241.25 mm");
  });
});
