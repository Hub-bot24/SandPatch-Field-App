import { formatChainage } from "@/lib/calculations/format";
import type { ExportRow } from "./exportData";

/** Exact column order required by the field spec. */
const HEADERS = [
  "uuid",
  "road",
  "contractJobNumber",
  "lotNumber",
  "operator",
  "dateTime",
  "gpsLatitude",
  "gpsLongitude",
  "gpsAccuracyM",
  "chainageKm",
  "offsetM",
  "direction",
  "controlLine",
  "existingSurface",
  "existingAggregateSize",
  "proposedAggregateSize",
  "sandVolumeMl",
  "diameter1Mm",
  "diameter2Mm",
  "diameter3Mm",
  "diameter4Mm",
  "averageDiameterMm",
  "textureDepthMm",
  "photo1Filename",
  "photo2Filename",
  "photo3Filename",
  "photo4Filename",
  "notes",
  "status",
  "createdAt",
  "updatedAt",
] as const;

/** UTF-8 BOM so Excel reliably detects encoding for names with special characters. */
export const CSV_BOM = "﻿";

function csvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToFields(row: ExportRow): (string | number)[] {
  const r = row.record;
  return [
    r.id,
    r.road,
    r.contractJobNumber,
    r.lotNumber,
    r.operator,
    r.testDateTime,
    r.gps?.latitude ?? "",
    r.gps?.longitude ?? "",
    r.gps?.accuracyM ?? "",
    r.chainageKm !== null ? formatChainage(r.chainageKm) : "",
    r.offsetM ?? "",
    r.direction ?? "",
    r.controlLine ?? "",
    r.existingSurface,
    r.existingAggregateSize,
    r.proposedAggregateSize,
    r.sandVolumeMl,
    r.diameter1Mm ?? "",
    r.diameter2Mm ?? "",
    r.diameter3Mm ?? "",
    r.diameter4Mm ?? "",
    r.averageDiameterMm ?? "",
    r.textureDepthMm !== null && r.textureDepthMm !== undefined ? r.textureDepthMm.toFixed(2) : "",
    row.photoFilenames[1] ?? "",
    row.photoFilenames[2] ?? "",
    row.photoFilenames[3] ?? "",
    row.photoFilenames[4] ?? "",
    r.notes,
    r.status,
    r.createdAt,
    r.updatedAt,
  ];
}

/** Builds the sand patch records CSV. Uses CRLF line endings for broad spreadsheet compatibility. */
export function buildCsv(rows: ExportRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push(rowToFields(row).map(csvField).join(","));
  }
  return lines.join("\r\n");
}
