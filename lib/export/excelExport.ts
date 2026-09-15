import type { ExportRow } from "./exportData";

/**
 * FUTURE (not Version 1): populate an existing Sand Patch Excel template
 * from the same `ExportRow[]` the CSV export uses - road, chainage,
 * offset, direction, control line, existing/proposed aggregate size, the
 * four diameters, average diameter, and texture depth.
 *
 * This is intentionally unimplemented and not wired into any UI. It exists
 * so the export logic stays isolated behind `buildExportDataset()` and a
 * later Excel writer can be added without touching CSV/ZIP export or the
 * capture screens.
 */
export async function exportToExcelTemplate(_rows: ExportRow[]): Promise<never> {
  throw new Error("NOT_IMPLEMENTED: Excel template export is a Version 2+ feature.");
}
