/**
 * Tap-to-measure: the field operator identifies four points on a photo of
 * the sand patch with a ruler laid across it - the two ends of a known
 * span on the ruler (calibration), then the two edges of the sand patch
 * along that same line - and this converts those taps into a diameter in
 * millimetres. This is not automatic computer-vision detection (see
 * types/measurement.ts for that still-NOT_IMPLEMENTED Version 2 contract):
 * every point is a deliberate human tap, so there is nothing here to
 * fabricate. It exists so the operator never has to read the ruler
 * mark-by-mark and type a number.
 */

export interface TapPoint {
  x: number;
  y: number;
}

export interface TapMeasurementInput {
  calibrationStart: TapPoint;
  calibrationEnd: TapPoint;
  /** Real-world distance between calibrationStart and calibrationEnd, e.g. the ruler length in mm. */
  calibrationLengthMm: number;
  edgeStart: TapPoint;
  edgeEnd: TapPoint;
}

export interface TapMeasurementResult {
  diameterMm: number;
  pixelsPerMm: number;
}

/**
 * Below this pixel separation, the two calibration taps are treated as
 * the same point (e.g. an accidental double-tap) rather than dividing by
 * a near-zero length and reporting a wild, meaningless diameter.
 */
const MIN_CALIBRATION_PIXELS = 4;

/**
 * Projects `point` onto the infinite line through `origin` in direction
 * `unit` (must be a unit vector), returning the signed distance from
 * `origin` along that line. Edge taps are projected onto the calibration
 * axis rather than measured as raw on-screen distance, so a tap that's a
 * few pixels off the ruler's exact line still measures along the ruler -
 * matching how the reading is physically taken.
 */
function projectOntoAxis(point: TapPoint, origin: TapPoint, unit: TapPoint): number {
  return (point.x - origin.x) * unit.x + (point.y - origin.y) * unit.y;
}

/**
 * Returns null (rather than Infinity/NaN) when the calibration points are
 * degenerate or the configured calibration length is invalid, so a bad
 * calibration tap can never silently produce a fabricated diameter.
 */
export function computeTapMeasurement(input: TapMeasurementInput): TapMeasurementResult | null {
  const { calibrationStart, calibrationEnd, calibrationLengthMm, edgeStart, edgeEnd } = input;

  if (!Number.isFinite(calibrationLengthMm) || calibrationLengthMm <= 0) {
    return null;
  }

  const axisX = calibrationEnd.x - calibrationStart.x;
  const axisY = calibrationEnd.y - calibrationStart.y;
  const calibrationPixelLength = Math.hypot(axisX, axisY);
  if (calibrationPixelLength < MIN_CALIBRATION_PIXELS) {
    return null;
  }

  const unit: TapPoint = { x: axisX / calibrationPixelLength, y: axisY / calibrationPixelLength };
  const pixelsPerMm = calibrationPixelLength / calibrationLengthMm;

  const projectedStart = projectOntoAxis(edgeStart, calibrationStart, unit);
  const projectedEnd = projectOntoAxis(edgeEnd, calibrationStart, unit);
  const diameterPixels = Math.abs(projectedEnd - projectedStart);

  return { diameterMm: diameterPixels / pixelsPerMm, pixelsPerMm };
}
