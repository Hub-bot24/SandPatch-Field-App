import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, upgrade, type SandPatchDBSchema } from "./schema";

let dbPromise: Promise<IDBPDatabase<SandPatchDBSchema>> | null = null;

/**
 * Lazily opens (and memoizes) the database connection. Must only be called
 * from client-side code (an effect or event handler) - `indexedDB` does
 * not exist while Next.js prerenders Client Components during `next build`.
 */
export function getDb(): Promise<IDBPDatabase<SandPatchDBSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
  if (!dbPromise) {
    dbPromise = openDB<SandPatchDBSchema>(DB_NAME, DB_VERSION, { upgrade });
  }
  return dbPromise;
}
