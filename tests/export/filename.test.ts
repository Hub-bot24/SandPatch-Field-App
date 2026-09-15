import { describe, expect, it } from "vitest";
import { buildPhotoBaseName, buildPhotoFilename, sanitiseFilename } from "@/lib/export/filename";

describe("sanitiseFilename", () => {
  it("replaces spaces with underscores", () => {
    expect(sanitiseFilename("Noondoo Mungindi")).toBe("Noondoo_Mungindi");
  });

  it("strips characters invalid in filenames on Windows/macOS/Linux", () => {
    expect(sanitiseFilename('Road: "North"/South\\Test*?<>|')).toBe("Road_NorthSouthTest");
  });

  it("strips control characters", () => {
    const withControlChar = `Road${String.fromCharCode(7)}Name`;
    expect(sanitiseFilename(withControlChar)).toBe("RoadName");
  });

  it("trims trailing dots and spaces", () => {
    expect(sanitiseFilename("Road Name...  ")).toBe("Road_Name");
  });

  it("collapses repeated whitespace/underscores to a single underscore", () => {
    expect(sanitiseFilename("Road   Name")).toBe("Road_Name");
  });

  it("falls back to 'Unnamed' for empty input", () => {
    expect(sanitiseFilename("")).toBe("Unnamed");
    expect(sanitiseFilename("   ")).toBe("Unnamed");
  });

  it("disambiguates a reserved Windows device name", () => {
    expect(sanitiseFilename("NUL")).toBe("NUL_");
    expect(sanitiseFilename("con")).toBe("con_");
  });
});

describe("buildPhotoBaseName / buildPhotoFilename", () => {
  it("matches the exact format from the field spec", () => {
    const base = buildPhotoBaseName("Noondoo Mungindi", 27.08, "LHS");
    expect(base).toBe("Noondoo_Mungindi_27.080_LHS");
    expect(buildPhotoFilename(base, 1)).toBe("Noondoo_Mungindi_27.080_LHS_Photo1.jpg");
  });

  it("never breaks the filename even with messy free-text road names", () => {
    const base = buildPhotoBaseName('Bad/Road:Name*?"<>|', 5, "RHS");
    expect(base).not.toMatch(/[\\/:*?"<>|]/);
  });
});
