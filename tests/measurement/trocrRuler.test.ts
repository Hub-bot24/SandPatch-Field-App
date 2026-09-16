import { describe, expect, it } from "vitest";
import { extractNumberFromGeneratedText } from "@/lib/measurement/trocrRuler";

describe("extractNumberFromGeneratedText", () => {
  it("extracts a clean whole number", () => {
    expect(extractNumberFromGeneratedText("100")).toBe(100);
  });

  it("extracts the longest digit run when the model generated extra text", () => {
    expect(extractNumberFromGeneratedText("mm 150 ruler")).toBe(150);
  });

  it("picks the longest digit run when several appear", () => {
    expect(extractNumberFromGeneratedText("1 200 3")).toBe(200);
  });

  it("returns null when there is no digit run at all", () => {
    expect(extractNumberFromGeneratedText("asphalt")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractNumberFromGeneratedText(undefined)).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(extractNumberFromGeneratedText("")).toBeNull();
  });

  it("returns null when the only digit run is implausibly long for a ruler mark", () => {
    expect(extractNumberFromGeneratedText("123456")).toBeNull();
  });
});
