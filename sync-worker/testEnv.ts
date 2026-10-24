import { NotesStore, type DurableObjectStorageLike, type Env } from './worker.js'

/** In-memory stand-in for Durable Object storage. */
export class FakeStorage implements DurableObjectStorageLike {
  map = new Map<string, unknown>()
  async get(key: string): Promise<unknown>
  async get(keys: string[]): Promise<Map<string, unknown>>
  async get(keys: string | string[]) {
    if (!Array.isArray(keys)) return structuredClone(this.map.get(keys))
    const found = new Map<string, unknown>()
    for (const key of keys) if (this.map.has(key)) found.set(key, structuredClone(this.map.get(key)))
    return found
  }
  async put(entries: Record<string, unknown>) {
    for (const [key, value] of Object.entries(entries)) this.map.set(key, structuredClone(value))
  }
  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.map.delete(key)
  }
  async deleteAll() {
    this.map.clear()
  }
}

export class FakeKV {
  map = new Map<string, string>()
  async get(key: string) {
    return this.map.get(key) ?? null
  }
  async put(key: string, value: string) {
    this.map.set(key, value)
  }
  async delete(key: string) {
    this.map.delete(key)
  }
}

export function makeEnv(options: { kv?: FakeKV; allowed?: string } = {}) {
  const objects = new Map<string, NotesStore>()
  const storages = new Map<string, FakeStorage>()
  const env: Env = {
    NOTES_STORE: {
      idFromName: (name: string) => name,
      get: (id: unknown) => {
        const key = String(id)
        if (!objects.has(key)) {
          const storage = new FakeStorage()
          storages.set(key, storage)
          objects.set(key, new NotesStore({ storage }, env))
        }
        return objects.get(key)!
      },
    },
    NOTES_KV: options.kv,
    ALLOWED_ADDRESSES: options.allowed,
  }
  return { env, storages }
}
