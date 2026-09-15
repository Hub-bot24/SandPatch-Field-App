/**
 * Sand patch calculations. These are the only calculations Version 1
 * performs - no binder allowance, seal design allowance, AGPT04K
 * allowance, or TMR adjustment is implemented or implied.
 */

function isValidDiameter(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Mean of the four diameter measurements. Returns null unless all four are
 * present and valid, so a partial record never displays a misleading
 * average computed from fewer than four readings.
 */
export function calculateAverageDiameter(
  diameter1: number | null | undefined,
  diameter2: number | null | undefined,
  diameter3: number | null | undefined,
  diameter4: number | null | undefined,
): number | null {
  const values = [diameter1, diameter2, diameter3, diameter4];
  if (!values.every(isValidDiameter)) {
    return null;
  }
  const sum = (values as number[]).reduce((a, b) => a + b, 0);
  return sum / 4;
}

/**
 * Texture depth (mm): TD = (4 x V x 1000) / (pi x D^2)
 * D = average diameter in mm, V = sand volume in mL.
 */
export function calculateTextureDepth(
  averageDiameterMm: number | null | undefined,
  sandVolumeMl: number,
): number | null {
  if (!isValidDiameter(averageDiameterMm)) {
    return null;
  }
  if (!Number.isFinite(sandVolumeMl) || sandVolumeMl <= 0) {
    return null;
  }
  return (4 * sandVolumeMl * 1000) / (Math.PI * averageDiameterMm * averageDiameterMm);
}
