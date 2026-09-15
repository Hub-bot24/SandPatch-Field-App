import type { Direction, PhotoNumber } from "@/types/record";
import { formatChainage } from "@/lib/calculations/format";

const RESERVED_WINDOWS_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/** True for ASCII control characters (0-31) and DEL (127), which are invalid in filenames. */
function isControlCharacter(codePoint: number): boolean {
  return codePoint < 32 || codePoint === 127;
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (!isControlCharacter(codePoint)) {
      result += char;
    }
  }
  return result;
}

/**
 * Strips characters that are invalid in filenames on Windows/macOS/Linux,
 * collapses whitespace to underscores, and trims trailing dots/spaces, so
 * free-text field values (road name, etc.) can never produce a filename
 * that breaks the export archive or fails to write on a given OS.
 */
export function sanitiseFilename(input: string): string {
  const withoutInvalidChars = stripControlCharacters(input ?? "").replace(/[\\/:*?"<>|]/g, "");
  const cleaned = withoutInvalidChars
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/[. ]+$/g, "");

  if (cleaned.length === 0) {
    return "Unnamed";
  }
  if (RESERVED_WINDOWS_NAMES.has(cleaned.toUpperCase())) {
    return `${cleaned}_`;
  }
  return cleaned;
}

/** e.g. "Noondoo Mungindi", 27.08, "LHS" -> "Noondoo_Mungindi_27.080_LHS" */
export function buildPhotoBaseName(
  road: string,
  chainageKm: number | null,
  direction: Direction | null,
): string {
  const parts = [
    sanitiseFilename(road || "UnknownRoad"),
    sanitiseFilename(chainageKm !== null ? formatChainage(chainageKm) : "NoChainage"),
    sanitiseFilename(direction ?? "NoDirection"),
  ];
  return parts.join("_");
}

/** e.g. "Noondoo_Mungindi_27.080_LHS_Photo1.jpg" */
export function buildPhotoFilename(baseName: string, photoNumber: PhotoNumber): string {
  return `${baseName}_Photo${photoNumber}.jpg`;
}
