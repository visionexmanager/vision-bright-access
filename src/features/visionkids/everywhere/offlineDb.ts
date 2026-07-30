/**
 * VisionKids Offline Data Layer.
 *
 * A tiny, dependency-free IndexedDB wrapper. Large/structured offline data
 * (downloads, creative drafts, the sync queue, cached content) lives here;
 * small flags live in localStorage (see prefs helpers). This is the ONLY module
 * that touches IndexedDB — the sync engine and download manager build on it, so
 * the storage backend can be swapped without touching feature code.
 */

const DB_NAME = "visionkids-offline";
const DB_VERSION = 1;

export type StoreName = "syncQueue" | "downloads" | "drafts" | "cache";

const STORES: StoreName[] = ["syncQueue", "downloads", "drafts", "cache"];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** True when IndexedDB is usable in this runtime. */
export function offlineAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export interface StoredRecord {
  id: string;
  [key: string]: unknown;
}

export async function putRecord(store: StoreName, record: StoredRecord): Promise<void> {
  await tx<IDBValidKey>(store, "readwrite", (s) => s.put(record));
}

export async function getRecord<T extends StoredRecord>(store: StoreName, id: string): Promise<T | null> {
  const r = await tx<T | undefined>(store, "readonly", (s) => s.get(id));
  return r ?? null;
}

export async function getAll<T extends StoredRecord>(store: StoreName): Promise<T[]> {
  const r = await tx<T[]>(store, "readonly", (s) => s.getAll());
  return r ?? [];
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  await tx<undefined>(store, "readwrite", (s) => s.delete(id));
}

export async function clearStore(store: StoreName): Promise<void> {
  await tx<undefined>(store, "readwrite", (s) => s.clear());
}

/** Rough storage estimate (MB used / quota) where the browser supports it. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMb: Math.round(usage / 1024 / 1024), quotaMb: Math.round(quota / 1024 / 1024) };
}
