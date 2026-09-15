import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from "idb";
import type { Job } from "@/types/job";
import type { PhotoRecord, SandPatchRecord } from "@/types/record";

export const DB_NAME = "sandpatch-db";

/**
 * Bump this when object stores/indexes need to change shape, and add a
 * branch to `upgrade` below for the new version. Existing stores/data must
 * never be dropped or cleared during an upgrade - see the module doc
 * comment on `upgrade`.
 */
export const DB_VERSION = 1;

export const STORE_JOB_SETTINGS = "jobSettings";
export const STORE_RECORDS = "records";
export const STORE_PHOTOS = "photos";

/** Singleton row id for the one "current" Job Setup. */
export const JOB_SETTINGS_ID = "current";

export interface SandPatchDBSchema extends DBSchema {
  [STORE_JOB_SETTINGS]: {
    key: string;
    value: Job;
  };
  [STORE_RECORDS]: {
    key: string;
    value: SandPatchRecord;
  };
  [STORE_PHOTOS]: {
    key: string;
    value: PhotoRecord;
    indexes: {
      by_recordId: string;
    };
  };
}

/**
 * Schema migrations. `oldVersion` is 0 on a brand-new database. Each branch
 * below is additive only (create stores/indexes if missing) so upgrading
 * an existing installation never drops previously saved job/record/photo
 * data - required because this app is used as QA evidence storage.
 */
export function upgrade(
  db: IDBPDatabase<SandPatchDBSchema>,
  oldVersion: number,
  _newVersion: number | null,
  _transaction: IDBPTransaction<SandPatchDBSchema, StoreNames<SandPatchDBSchema>[], "versionchange">,
): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(STORE_JOB_SETTINGS)) {
      db.createObjectStore(STORE_JOB_SETTINGS, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains(STORE_RECORDS)) {
      db.createObjectStore(STORE_RECORDS, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
      const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
      photoStore.createIndex("by_recordId", "recordId", { unique: false });
    }
  }
  // Future versions: add `if (oldVersion < 2) { ... }` blocks here that only
  // create/alter stores and indexes - never delete a store or clear data.
}
