import { describe, expect, it } from "vitest";
import { computeRecordStatus, type RecordStatusInput } from "@/lib/calculations/recordStatus";

const COMPLETE: RecordStatusInput = {
  chainageKm: 27.08,
  diameter1Mm: 240,
  diameter2Mm: 245,
  diameter3Mm: 238,
  diameter4Mm: 242,
};

describe("computeRecordStatus", () => {
  it("is READY when chainage, all four diameters, and all four photos are present", () => {
    expect(computeRecordStatus(COMPLETE, [1, 2, 3, 4])).toBe("READY");
  });

  it("is INCOMPLETE when chainage is missing", () => {
    expect(computeRecordStatus({ ...COMPLETE, chainageKm: null }, [1, 2, 3, 4])).toBe("INCOMPLETE");
  });

  it("is INCOMPLETE when any diameter is missing", () => {
    expect(computeRecordStatus({ ...COMPLETE, diameter3Mm: null }, [1, 2, 3, 4])).toBe("INCOMPLETE");
  });

  it("is INCOMPLETE when fewer than four photos are present", () => {
    expect(computeRecordStatus(COMPLETE, [1, 2, 3])).toBe("INCOMPLETE");
  });

  it("is INCOMPLETE with no photos at all", () => {
    expect(computeRecordStatus(COMPLETE, [])).toBe("INCOMPLETE");
  });

  it("treats a negative chainage as not present (chainage must be non-negative)", () => {
    expect(computeRecordStatus({ ...COMPLETE, chainageKm: -1 }, [1, 2, 3, 4])).toBe("INCOMPLETE");
  });

  it("allows a zero chainage (start of road) to count as present", () => {
    expect(computeRecordStatus({ ...COMPLETE, chainageKm: 0 }, [1, 2, 3, 4])).toBe("READY");
  });

  it("does not require photo array order - only presence of all four numbers", () => {
    expect(computeRecordStatus(COMPLETE, [4, 1, 3, 2])).toBe("READY");
  });
});
