import { getDb } from "./client";
import { STORE_PHOTOS, STORE_RECORDS } from "./schema";

/**
 * Deletes photo rows whose parent record no longer exists. This can only
 * happen if a new-record draft captured photos and the app/tab was killed
 * before the draft's own cleanup ran (see the New Record page) - it never
 * touches a photo that belongs to a record that still exists.
 */
export async function purgeOrphanedPhotos(): Promise<number> {
  const db = await getDb();
  const [records, photos] = await Promise.all([
    db.getAll(STORE_RECORDS),
    db.getAll(STORE_PHOTOS),
  ]);
  const recordIds = new Set(records.map((r) => r.id));
  const orphaned = photos.filter((p) => !recordIds.has(p.recordId));
  if (orphaned.length === 0) {
    return 0;
  }

  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  await Promise.all(orphaned.map((p) => tx.objectStore(STORE_PHOTOS).delete(p.id)));
  await tx.done;
  return orphaned.length;
}
