import JSZip from "jszip";
import { PHOTO_NUMBERS } from "@/types/record";
import { buildCsv, CSV_BOM } from "./csvExport";
import type { ExportRow } from "./exportData";

/** Builds the export ZIP: the records CSV plus a photos/ folder. */
export async function buildExportZip(rows: ExportRow[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file("sand_patch_records.csv", CSV_BOM + buildCsv(rows));

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
