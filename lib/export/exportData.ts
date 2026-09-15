import { listAllRecordsSorted } from "@/lib/db/recordRepository";
import { getPhotoMap } from "@/lib/db/photoRepository";
import { PHOTO_NUMBERS, type PhotoNumber, type PhotoRecord, type SandPatchRecord } from "@/types/record";
import { buildPhotoBaseName, buildPhotoFilename } from "./filename";

/**
 * One normalized row per record, joining the record with its resolved
 * photo filenames/blobs. Shared by the CSV export and the future Excel
 * template export so both consume the same data shape.
 */
export interface ExportRow {
  record: SandPatchRecord;
  photos: Partial<Record<PhotoNumber, PhotoRecord>>;
  photoFilenames: Partial<Record<PhotoNumber, string>>;
}

function uniqueBaseName(base: string, used: Map<string, number>): string {
  const priorCount = used.get(base) ?? 0;
  used.set(base, priorCount + 1);
  // First record with a given road/chainage/direction keeps the clean
  // name from the spec; any later collision (e.g. a duplicate re-test) is
  // disambiguated rather than silently overwriting the first in the zip.
  return priorCount === 0 ? base : `${base}-${priorCount + 1}`;
}

export async function buildExportDataset(): Promise<ExportRow[]> {
  const records = await listAllRecordsSorted();
  const usedBaseNames = new Map<string, number>();
  const rows: ExportRow[] = [];

  for (const record of records) {
    const photos = await getPhotoMap(record.id);
    const baseName = uniqueBaseName(
      buildPhotoBaseName(record.road, record.chainageKm, record.direction),
      usedBaseNames,
    );
    const photoFilenames: Partial<Record<PhotoNumber, string>> = {};
    for (const photoNumber of PHOTO_NUMBERS) {
      if (photos[photoNumber]) {
        photoFilenames[photoNumber] = buildPhotoFilename(baseName, photoNumber);
      }
    }
    rows.push({ record, photos, photoFilenames });
  }

  return rows;
}
