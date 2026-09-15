import JSZip from "jszip";
import { PHOTO_NUMBERS } from "@/types/record";
import type { Job } from "@/types/job";
import { buildCsv, CSV_BOM } from "./csvExport";
import { exportToExcelTemplate } from "./excelExport";
import type { ExportRow } from "./exportData";

/** Builds the export ZIP: the records CSV, the populated lab Excel template, plus a photos/ folder. */
export async function buildExportZip(rows: ExportRow[], job: Job | null): Promise<Blob> {
  const zip = new JSZip();
  zip.file("sand_patch_records.csv", CSV_BOM + buildCsv(rows));

  try {
    const excelBlob = await exportToExcelTemplate(rows, job);
    zip.file("sand_patch_lab_form.xlsx", excelBlob);
  } catch (err) {
    // The CSV above already carries every field losslessly - the Excel lab
    // form is a convenience on top of it, so a failure here (e.g. offline
    // on a device that has never cached the template) must not block the
    // rest of the export.
    zip.file(
      "sand_patch_lab_form_UNAVAILABLE.txt",
      `The Excel lab form could not be generated: ${err instanceof Error ? err.message : String(err)}\n` +
        "All data is still present in sand_patch_records.csv.",
    );
  }

  const photosFolder = zip.folder("photos");
  if (!photosFolder) {
    throw new Error("Failed to create the photos folder in the export archive.");
  }

  for (const row of rows) {
    for (const photoNumber of PHOTO_NUMBERS) {
      const photo = row.photos[photoNumber];
      const filename = row.photoFilenames[photoNumber];
      if (photo && filename) {
        photosFolder.file(filename, photo.blob);
      }
    }
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
