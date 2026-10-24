import { createNotesRepo, createQueueLock, type KeyValueStore, type Lock } from '../../src/lib/notesRepo'

const DB_NAME = 'note-it-down'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error ?? new Error('Storage write aborted'))
      })
  )
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('note-it-down') : null
type ChangeListener = (key: string) => void
const listeners = new Set<ChangeListener>()

/** Fires for changes made in this tab and in other tabs of the app. */
export function onStorageChange(listener: ChangeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(key: string, fromOtherTab: boolean) {
  for (const listener of listeners) listener(key)
  if (!fromOtherTab) channel?.postMessage(key)
}
channel?.addEventListener('message', (event) => notify(String(event.data), true))

export const kv: KeyValueStore & { remove(key: string): Promise<void> } = {
  get: (key) => tx('readonly', (store) => store.get(key)),
  async set(key, value) {
    await tx('readwrite', (store) => store.put(value, key))
    notify(key, false)
  },
  async remove(key) {
    await tx('readwrite', (store) => store.delete(key))
    notify(key, false)
  },
}

// Web Locks serialise writes across tabs; fall back to an in-tab queue.
const lock: Lock =
  typeof navigator !== 'undefined' && navigator.locks
    ? <T,>(fn: () => Promise<T>) => navigator.locks.request('nid-notes', fn) as Promise<T>
    : createQueueLock()

export const repo = createNotesRepo(kv, lock)

// Ask the browser not to evict notes under storage pressure (important on iOS).
void navigator.storage?.persist?.().catch(() => {})
