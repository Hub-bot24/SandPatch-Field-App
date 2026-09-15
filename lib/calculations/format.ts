const EMPTY = "—";

/**
 * Chainage is always displayed to exactly 3 decimal places (e.g. 27.080),
 * never trimmed to 27.08, regardless of how it was typed - the stored value
 * is numeric, so 27.08 and 27.080 are the same number and this is the one
 * formatting rule that presents it correctly everywhere (cards, detail
 * view, CSV).
 */
export function formatChainage(chainageKm: number | null | undefined): string {
  if (typeof chainageKm !== "number" || !Number.isFinite(chainageKm)) {
    return EMPTY;
  }
  return chainageKm.toFixed(3);
}

export function formatAverageDiameter(averageDiameterMm: number | null | undefined): string {
  if (typeof averageDiameterMm !== "number" || !Number.isFinite(averageDiameterMm)) {
    return EMPTY;
  }
  return `${averageDiameterMm.toFixed(2)} mm`;
}

/** Texture depth is always shown to 2 decimal places, e.g. 1.09 mm. */
export function formatTextureDepth(textureDepthMm: number | null | undefined): string {
  if (typeof textureDepthMm !== "number" || !Number.isFinite(textureDepthMm)) {
    return EMPTY;
  }
  return `${textureDepthMm.toFixed(2)} mm`;
}

export function formatGpsCoordinate(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return EMPTY;
  }
  return value.toFixed(6);
}

export function formatGpsAccuracy(accuracyM: number | null | undefined): string {
  if (typeof accuracyM !== "number" || !Number.isFinite(accuracyM)) {
    return EMPTY;
  }
  return `±${accuracyM.toFixed(1)} m`;
}
