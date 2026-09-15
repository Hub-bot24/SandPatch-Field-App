import { getDb } from "./client";
import { STORE_PHOTOS, STORE_RECORDS } from "./schema";
import type { SandPatchRecord } from "@/types/record";

/**
 * Creates a brand-new record. Uses `add` (not `put`) so an id collision
 * throws instead of silently overwriting an existing record.
 */
export async function createRecord(record: SandPatchRecord): Promise<void> {
  const db = await getDb();
  await db.add(STORE_RECORDS, record);
}

/**
 * Updates an existing record in place: preserves the original id and
 * createdAt, and always bumps updatedAt. Throws if the record does not
 * already exist, so an edit can never accidentally create a duplicate.
 */
export async function updateRecord(record: SandPatchRecord): Promise<SandPatchRecord> {
  const db = await getDb();
  const existing = await db.get(STORE_RECORDS, record.id);
  if (!existing) {
    throw new Error(`Cannot update record ${record.id}: it does not exist.`);
  }
  const updated: SandPatchRecord = {
    ...record,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_RECORDS, updated);
  return updated;
}

export async function getRecord(id: string): Promise<SandPatchRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_RECORDS, id);
}

export async function listAllRecords(): Promise<SandPatchRecord[]> {
  const db = await getDb();
  return db.getAll(STORE_RECORDS);
}

/**
 * Sorted by road, then chainage ascending, per the field spec. Sorted in
 * JS rather than via an IndexedDB compound index: an index keyed on
 * [road, chainageKm] would silently exclude any record whose chainage is
 * still null (IndexedDB omits a record from an index when any key path
 * component is null/undefined), hiding legitimate INCOMPLETE drafts from
 * the list entirely.
 */
export async function listAllRecordsSorted(): Promise<SandPatchRecord[]> {
  const records = await listAllRecords();
  return records.slice().sort((a, b) => {
    const roadCompare = a.road.localeCompare(b.road, undefined, { sensitivity: "base" });
    if (roadCompare !== 0) return roadCompare;
    const aChainage = a.chainageKm ?? Number.POSITIVE_INFINITY;
    const bChainage = b.chainageKm ?? Number.POSITIVE_INFINITY;
    return aChainage - bChainage;
  });
}

/** Deletes a record and every photo associated with it, atomically. */
export async function deleteRecordCascade(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([STORE_RECORDS, STORE_PHOTOS], "readwrite");
  const photoStore = tx.objectStore(STORE_PHOTOS);
  const photoKeys = await photoStore.index("by_recordId").getAllKeys(id);
  await Promise.all([
    tx.objectStore(STORE_RECORDS).delete(id),
    ...photoKeys.map((key) => photoStore.delete(key)),
  ]);
  await tx.done;
}
