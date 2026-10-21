type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void

/** A device's chrome.storage.local contents. */
export type FakeStore = Record<string, unknown>

const clone = <T,>(value: T): T => (value === undefined ? value : structuredClone(value))

let current: FakeStore = {}
let failWrites = false
const listeners = new Set<Listener>()

function keyList(keys: string | string[] | null | undefined): string[] {
  if (keys == null) return Object.keys(current)
  return Array.isArray(keys) ? keys : [keys]
}

const local = {
  async get(keys?: string | string[] | null) {
    const result: Record<string, unknown> = {}
    for (const key of keyList(keys)) if (key in current) result[key] = clone(current[key])
    return result
  },
  async set(items: Record<string, unknown>) {
    if (failWrites) throw new Error('QUOTA_BYTES quota exceeded')
    const changes: Record<string, chrome.storage.StorageChange> = {}
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: current[key], newValue: clone(value) }
      current[key] = clone(value)
    }
    for (const listener of listeners) listener(changes, 'local')
  },
  async remove(keys: string | string[]) {
    for (const key of keyList(keys)) delete current[key]
  },
}

/** Installs a minimal chrome.* global backed by an in-memory store. */
export function installFakeChrome(): void {
  ;(globalThis as { chrome?: unknown }).chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local,
      onChanged: {
        addListener: (l: Listener) => listeners.add(l),
        removeListener: (l: Listener) => listeners.delete(l),
      },
    },
  }
}

/** Points chrome.storage.local at another device's data. */
export function switchStore(store: FakeStore): void {
  current = store
}

export function setFailWrites(value: boolean): void {
  failWrites = value
}
