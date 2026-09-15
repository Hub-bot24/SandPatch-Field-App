import { buildExportDataset, type ExportRow } from "./exportData";
import { buildExportZip } from "./zipExport";
import { sanitiseFilename } from "./filename";

export interface ExportSummary {
  recordCount: number;
  readyCount: number;
  incompleteCount: number;
}

export function summariseRows(rows: ExportRow[]): ExportSummary {
  const readyCount = rows.filter((row) => row.record.status === "READY").length;
  return {
    recordCount: rows.length,
    readyCount,
    incompleteCount: rows.length - readyCount,
  };
}

/** Loads the current dataset without exporting - used to show preview counts. */
export async function getExportPreview(): Promise<ExportSummary> {
  const rows = await buildExportDataset();
  return summariseRows(rows);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Delay revoking so Safari has time to actually start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Builds the export ZIP from the latest data and triggers a browser download. */
export async function exportJob(jobLabel: string): Promise<ExportSummary> {
  const rows = await buildExportDataset();
  const zipBlob = await buildExportZip(rows);

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `SandPatch_${sanitiseFilename(jobLabel || "Export")}_${datePart}.zip`;
  downloadBlob(zipBlob, filename);

  return summariseRows(rows);
}
