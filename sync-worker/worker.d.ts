// Types for tests that import the worker (the worker itself is plain JS).
export interface Env {
  NOTES_STORE: {
    idFromName(name: string): unknown
    get(id: unknown): { fetch(request: Request): Promise<Response> }
  }
  NOTES_KV?: {
    get(key: string): Promise<string | null>
    put(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }
  ALLOWED_ADDRESSES?: string
}

export interface DurableObjectStorageLike {
  get(key: string): Promise<unknown>
  get(keys: string[]): Promise<Map<string, unknown>>
  put(entries: Record<string, unknown>): Promise<void>
  delete(keys: string | string[]): Promise<unknown>
  deleteAll(): Promise<void>
}

declare const worker: {
  fetch(request: Request, env: Env): Promise<Response>
}
export default worker

export declare class NotesStore {
  constructor(ctx: { storage: DurableObjectStorageLike }, env: Env)
  fetch(request: Request): Promise<Response>
}
