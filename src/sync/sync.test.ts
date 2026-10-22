import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, switchStore, type FakeStore } from '../test/fakeChrome'
import worker from '../../sync-worker/worker.js'
import { makeEnv } from '../../sync-worker/testEnv'
import { sync, checkWorker } from './sync'
import { generateToken } from './crypto'
import { addNote, deleteNote, readNotes, updateNote } from '../background/notesStore'
import { generateId } from '../lib/notes'

installFakeChrome()

const SERVER = 'https://sync.example.workers.dev'
const realFetch = globalThis.fetch

type Hook = (request: Request) => Promise<void> | void
let requests: Request[]
let beforeRequest: Hook | null

function serveWorker(env: ReturnType<typeof makeEnv>['env']) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // Node's Request doesn't implement the cache option the client sets.
    const request = new Request(input, { ...init, cache: undefined })
    requests.push(request.clone())
    if (beforeRequest) {
      const hook = beforeRequest
      beforeRequest = null
      await hook(request)
    }
    return worker.fetch(request, env)
  }) as typeof fetch
}

let token: string
let deviceA: FakeStore
let deviceB: FakeStore
const config = () => ({ serverUrl: SERVER, token })

async function on<T>(device: FakeStore, fn: () => Promise<T>): Promise<T> {
  switchStore(device)
  return fn()
}

beforeEach(() => {
  token = generateToken()
  deviceA = {}
  deviceB = {}
  requests = []
  beforeRequest = null
  serveWorker(makeEnv().env)
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('sync', () => {
  it('uploads from one device and downloads on another', async () => {
    const id = generateId()
    await on(deviceA, () => addNote({ id, title: 'Hello', body: 'from A' }))
    expect(await on(deviceA, () => sync(config()))).toMatchObject({ success: true })

    expect(await on(deviceB, () => sync(config()))).toMatchObject({ success: true })
    expect(await on(deviceB, readNotes)).toEqual([expect.objectContaining({ id, body: 'from A' })])
  })

  it('keeps both sides of a concurrent edit on every device', async () => {
    const id = generateId()
    await on(deviceA, () => addNote({ id, title: 'Shared', body: 'v1' }))
    await on(deviceA, () => sync(config()))
    await on(deviceB, () => sync(config()))

    // A autosaves several times; B makes one later edit.
    for (const body of ['a1', 'a2', 'a3', 'a4']) await on(deviceA, () => updateNote(id, { title: 'Shared', body }))
    await new Promise((r) => setTimeout(r, 5))
    await on(deviceB, () => updateNote(id, { title: 'Shared', body: 'b1' }))

    await on(deviceA, () => sync(config()))
    await on(deviceB, () => sync(config()))
    await on(deviceA, () => sync(config()))

    for (const device of [deviceA, deviceB]) {
      const bodies = (await on(device, readNotes)).map((n) => n.body).sort()
      expect(bodies).toEqual(['a4', 'b1'])
    }
  })

  it('propagates deletions and never resurrects them', async () => {
    const id = generateId()
    await on(deviceA, () => addNote({ id, title: 'Doomed', body: 'x' }))
    await on(deviceA, () => sync(config()))
    await on(deviceB, () => sync(config()))

    await on(deviceA, () => deleteNote(id))
    await on(deviceA, () => sync(config()))
    await on(deviceB, () => sync(config()))
    await on(deviceA, () => sync(config()))

    for (const device of [deviceA, deviceB]) {
      const notes = await on(device, readNotes)
      expect(notes.filter((n) => !n.deleted)).toHaveLength(0)
    }
  })

  it('skips the upload when nothing changed', async () => {
    await on(deviceA, () => addNote({ id: generateId(), title: 'T', body: '' }))
    await on(deviceA, () => sync(config()))
    requests = []
    expect(await on(deviceA, () => sync(config()))).toMatchObject({ success: true })
    expect(requests.map((r) => r.method)).toEqual(['GET'])
  })

  it('retries and merges when another device writes between download and upload', async () => {
    const idA = generateId()
    const idB = generateId()
    await on(deviceA, () => addNote({ id: idA, title: 'A', body: '' }))
    await on(deviceA, () => sync(config()))
    await on(deviceB, () => sync(config()))
    await on(deviceB, () => addNote({ id: idB, title: 'B', body: '' }))
    await on(deviceA, () => updateNote(idA, { title: 'A', body: 'edited' }))

    // Just before A uploads, B completes a whole sync.
    let injected = false
    const hookForPut: Hook = async (request) => {
      if (request.method !== 'PUT' || injected) {
        beforeRequest = hookForPut
        return
      }
      injected = true
      await on(deviceB, () => sync(config()))
      switchStore(deviceA)
    }
    beforeRequest = hookForPut

    expect(await on(deviceA, () => sync(config()))).toMatchObject({ success: true })
    beforeRequest = null
    await on(deviceB, () => sync(config()))

    for (const device of [deviceA, deviceB]) {
      const notes = await on(device, readNotes)
      expect(notes.map((n) => n.title).sort()).toEqual(['A', 'B'])
      expect(notes.find((n) => n.id === idA)?.body).toBe('edited')
    }
  })

  it('does not lose a local edit made while a sync is running', async () => {
    const id = generateId()
    await on(deviceA, () => addNote({ id, title: 'T', body: 'before' }))
    beforeRequest = () => {
      void updateNote(id, { title: 'T', body: 'typed during sync' })
    }
    await on(deviceA, () => sync(config()))
    expect((await on(deviceA, readNotes))[0].body).toBe('typed during sync')
  })

  it('refuses to treat an unrelated 404 page as an empty sync server', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, { method: init?.method }))
      return new Response('<html>Not Found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
    }) as typeof fetch

    const result = await on(deviceA, () => sync(config()))
    expect(result.success).toBe(false)
    expect(requests.every((r) => r.method === 'GET')).toBe(true)
  })

  it('rejects server URLs that are not absolute https', async () => {
    const result = await on(deviceA, () => sync({ serverUrl: 'my-worker.workers.dev', token }))
    expect(result).toMatchObject({ success: false, error: expect.stringMatching(/full URL|https/) })
    expect(requests).toHaveLength(0)
  })

  it('recognises the worker via its health endpoint', async () => {
    expect(await checkWorker(SERVER)).toBe('ok')
  })
})
