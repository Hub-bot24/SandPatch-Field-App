export interface NumericFieldValidation {
  valid: boolean;
  error?: string;
  parsed: number | null;
}

/** Empty input is always valid (an untouched field keeps the record INCOMPLETE, not invalid). */
function validateOptionalNumber(
  raw: string,
  { allowNegative = true, mustBePositive = false }: { allowNegative?: boolean; mustBePositive?: boolean } = {},
): NumericFieldValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { valid: true, parsed: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { valid: false, error: "Must be a number.", parsed: null };
  }
  if (!allowNegative && parsed < 0) {
    return { valid: false, error: "Cannot be negative.", parsed: null };
  }
  if (mustBePositive && parsed <= 0) {
    return { valid: false, error: "Must be greater than zero.", parsed: null };
  }
  return { valid: true, parsed };
}

/** Chainage: numeric and non-negative. No upper bound is imposed. */
export function validateChainageInput(raw: string): NumericFieldValidation {
  return validateOptionalNumber(raw, { allowNegative: false });
}

/**
 * Diameter: any sensible positive number. Deliberately has no hard-coded
 * narrow maximum, so legitimate large field readings are never rejected.
 */
export function validateDiameterInput(raw: string): NumericFieldValidation {
  return validateOptionalNumber(raw, { allowNegative: false, mustBePositive: true });
}

/** Offset may legitimately be signed (e.g. left/right of a centreline). */
export function validateOffsetInput(raw: string): NumericFieldValidation {
  return validateOptionalNumber(raw, { allowNegative: true });
}

export function isValidSandVolume(value: number): value is 50 | 100 {
  return value === 50 || value === 100;
}
