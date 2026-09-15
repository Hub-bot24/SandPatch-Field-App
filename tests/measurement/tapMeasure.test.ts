import { describe, expect, it } from "vitest";
import { computeTapMeasurement } from "@/lib/measurement/tapMeasure";

describe("computeTapMeasurement", () => {
  it("measures along an axis-aligned ruler", () => {
    const result = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 100, y: 0 },
      calibrationLengthMm: 100,
      edgeStart: { x: 20, y: 0 },
      edgeEnd: { x: 70, y: 0 },
    });
    expect(result).not.toBeNull();
    expect(result?.diameterMm).toBeCloseTo(50, 6);
    expect(result?.pixelsPerMm).toBeCloseTo(1, 6);
  });

  it("scales correctly when the ruler's known length differs from its pixel length", () => {
    // 300mm ruler spans 150px on screen -> 0.5 px/mm.
    const result = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 150, y: 0 },
      calibrationLengthMm: 300,
      edgeStart: { x: 50, y: 0 },
      edgeEnd: { x: 100, y: 0 },
    });
    expect(result?.pixelsPerMm).toBeCloseTo(0.5, 6);
    // 50px apart at 0.5 px/mm = 100mm.
    expect(result?.diameterMm).toBeCloseTo(100, 6);
  });

  it("projects edge taps that are slightly off the ruler's exact line", () => {
    const result = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 100, y: 0 },
      calibrationLengthMm: 100,
      edgeStart: { x: 20, y: 5 },
      edgeEnd: { x: 70, y: -5 },
    });
    // The y-offsets are perpendicular to the axis and must not affect the
    // measured distance along it.
    expect(result?.diameterMm).toBeCloseTo(50, 6);
  });

  it("measures correctly along a diagonal ruler", () => {
    // A 3-4-5 triangle scaled by 20: calibration axis has pixel length 100.
    const result = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 60, y: 80 },
      calibrationLengthMm: 100,
      edgeStart: { x: 12, y: 16 }, // 20 units along the axis
      edgeEnd: { x: 42, y: 56 }, // 70 units along the axis
    });
    expect(result?.diameterMm).toBeCloseTo(50, 6);
  });

  it("does not depend on the order edges are tapped in", () => {
    const forward = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 100, y: 0 },
      calibrationLengthMm: 100,
      edgeStart: { x: 20, y: 0 },
      edgeEnd: { x: 70, y: 0 },
    });
    const reversed = computeTapMeasurement({
      calibrationStart: { x: 0, y: 0 },
      calibrationEnd: { x: 100, y: 0 },
      calibrationLengthMm: 100,
      edgeStart: { x: 70, y: 0 },
      edgeEnd: { x: 20, y: 0 },
    });
    expect(forward?.diameterMm).toBeCloseTo(reversed?.diameterMm ?? -1, 6);
  });

  it("returns null when the two calibration taps are the same point", () => {
    const result = computeTapMeasurement({
      calibrationStart: { x: 10, y: 10 },
      calibrationEnd: { x: 10, y: 10 },
      calibrationLengthMm: 300,
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 50, y: 50 },
    });
    expect(result).toBeNull();
  });

  it("returns null when the calibration taps are implausibly close together", () => {
    const result = computeTapMeasurement({
      calibrationStart: { x: 10, y: 10 },
      calibrationEnd: { x: 11, y: 10 },
      calibrationLengthMm: 300,
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 50, y: 50 },
    });
    expect(result).toBeNull();
  });

  it("returns null for a non-positive calibration length instead of dividing by zero", () => {
    expect(
      computeTapMeasurement({
        calibrationStart: { x: 0, y: 0 },
        calibrationEnd: { x: 100, y: 0 },
        calibrationLengthMm: 0,
        edgeStart: { x: 20, y: 0 },
        edgeEnd: { x: 70, y: 0 },
      }),
    ).toBeNull();

    expect(
      computeTapMeasurement({
        calibrationStart: { x: 0, y: 0 },
        calibrationEnd: { x: 100, y: 0 },
        calibrationLengthMm: -300,
        edgeStart: { x: 20, y: 0 },
        edgeEnd: { x: 70, y: 0 },
      }),
    ).toBeNull();
  });
});
