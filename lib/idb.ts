// Minimal, dependency-free promise wrapper over IndexedDB.
//
// Values are stored as already-serialized JSON strings so the surrounding code
// keeps the exact same `localStorage`-style semantics (string in / string out).
// This is the durable, large-capacity backing store for the app (IndexedDB has
// no practical ~5-10MB cap like localStorage), powering the local-first vision.

const DB_NAME = "json-formatter"
const DB_VERSION = 1
const STORE_NAME = "kv"

let dbPromise: Promise<IDBDatabase> | null = null

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined"
}

function openDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB unavailable"))
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error("IndexedDB open blocked"))
  })

  return dbPromise
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const request = fn(transaction.objectStore(STORE_NAME))
        transaction.oncomplete = () => resolve(request.result as T)
        transaction.onabort = () => reject(transaction.error)
        transaction.onerror = () => reject(transaction.error)
      }),
  )
}

export function idbGet(key: string): Promise<string | undefined> {
  return run<string | undefined>("readonly", (s) => s.get(key))
}

export function idbSet(key: string, value: string): Promise<void> {
  return run<IDBValidKey>("readwrite", (s) => s.put(value, key)).then(() => undefined)
}

export function idbDelete(key: string): Promise<void> {
  return run<undefined>("readwrite", (s) => s.delete(key)).then(() => undefined)
}

// Read every stored [key, value] pair — used once at startup to hydrate the
// in-memory cache from the durable store.
export function idbEntries(): Promise<Array<[string, string]>> {
  return openDB().then(
    (db) =>
      new Promise<Array<[string, string]>>((resolve, reject) => {
        const out: Array<[string, string]> = []
        const transaction = db.transaction(STORE_NAME, "readonly")
        const cursorReq = transaction.objectStore(STORE_NAME).openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor) {
            out.push([String(cursor.key), cursor.value as string])
            cursor.continue()
          }
        }
        transaction.oncomplete = () => resolve(out)
        transaction.onerror = () => reject(transaction.error)
      }),
  )
}
