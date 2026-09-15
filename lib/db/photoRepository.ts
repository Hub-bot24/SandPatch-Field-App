import { getDb } from "./client";
import { STORE_PHOTOS } from "./schema";
import type { PhotoNumber, PhotoRecord } from "@/types/record";
import { createId } from "@/lib/utils/id";

export async function getPhotosForRecord(recordId: string): Promise<PhotoRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex(STORE_PHOTOS, "by_recordId", recordId);
}

/** Keyed by photoNumber (1-4), never by array position. */
export async function getPhotoMap(
  recordId: string,
): Promise<Partial<Record<PhotoNumber, PhotoRecord>>> {
  const photos = await getPhotosForRecord(recordId);
  const map: Partial<Record<PhotoNumber, PhotoRecord>> = {};
  for (const photo of photos) {
    map[photo.photoNumber] = photo;
  }
  return map;
}

/**
 * Saves (or replaces) the photo for one (recordId, photoNumber) slot. Any
 * prior photo doc(s) for that exact slot are removed and a new one
 * inserted in the same transaction, so a slot is always resolved by
 * recordId + photoNumber - never by array position or insertion order.
 */
export async function savePhoto(
  recordId: string,
  photoNumber: PhotoNumber,
  blob: Blob,
): Promise<PhotoRecord> {
  const db = await getDb();
  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);
  const existingForRecord = await store.index("by_recordId").getAll(recordId);
  const stale = existingForRecord.filter((p) => p.photoNumber === photoNumber);

  const photo: PhotoRecord = {
    id: createId(),
    recordId,
    photoNumber,
    blob,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([...stale.map((p) => store.delete(p.id)), store.put(photo)]);
  await tx.done;
  return photo;
}

export async function deletePhoto(recordId: string, photoNumber: PhotoNumber): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);
  const existingForRecord = await store.index("by_recordId").getAll(recordId);
  const stale = existingForRecord.filter((p) => p.photoNumber === photoNumber);
  await Promise.all(stale.map((p) => store.delete(p.id)));
  await tx.done;
}

export async function deletePhotosForRecord(recordId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);
  const keys = await store.index("by_recordId").getAllKeys(recordId);
  await Promise.all(keys.map((key) => store.delete(key)));
  await tx.done;
}

export async function countPhotosForRecord(recordId: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex(STORE_PHOTOS, "by_recordId", recordId);
}
