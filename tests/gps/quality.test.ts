import { describe, expect, it } from "vitest";
import { classifyGpsAccuracy } from "@/lib/gps/quality";

describe("classifyGpsAccuracy", () => {
  it("is GOOD at or below 10m", () => {
    expect(classifyGpsAccuracy(0)).toBe("GOOD");
    expect(classifyGpsAccuracy(5)).toBe("GOOD");
    expect(classifyGpsAccuracy(10)).toBe("GOOD");
  });

  it("is CHECK above 10m and at or below 20m", () => {
    expect(classifyGpsAccuracy(10.1)).toBe("CHECK");
    expect(classifyGpsAccuracy(15)).toBe("CHECK");
    expect(classifyGpsAccuracy(20)).toBe("CHECK");
  });

  it("is POOR above 20m", () => {
    expect(classifyGpsAccuracy(20.1)).toBe("POOR");
    expect(classifyGpsAccuracy(100)).toBe("POOR");
  });

  it("returns null for missing or invalid accuracy", () => {
    expect(classifyGpsAccuracy(null)).toBeNull();
    expect(classifyGpsAccuracy(undefined)).toBeNull();
    expect(classifyGpsAccuracy(-1)).toBeNull();
    expect(classifyGpsAccuracy(Number.NaN)).toBeNull();
  });
});
