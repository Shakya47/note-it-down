import { describe, expect, it } from 'vitest'
import worker from './worker.js'
import { FakeKV, makeEnv } from './testEnv'
import { deriveKeys, generateToken } from '../src/sync/crypto'

type Env = ReturnType<typeof makeEnv>['env']

const call = (env: Env, method: string, path: string, body?: unknown) =>
  worker.fetch(
    new Request(`https://w.example${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env
  )

async function account() {
  const keys = await deriveKeys(generateToken())
  return { ...keys, path: `/v1/${keys.address}` }
}

async function sha256Hex(s: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

describe('sync worker', () => {
  it('answers the health check', async () => {
    const res = await call(makeEnv().env, 'GET', '/v1/health')
    expect(await res.json()).toEqual({ service: 'note-it-down-sync', version: 2 })
  })

  it('does not answer unknown routes with the "no data yet" response', async () => {
    const res = await call(makeEnv().env, 'GET', '/some/other/page')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'bad_route' })
  })

  it('reports missing data with code no_data', async () => {
    const { path } = await account()
    const res = await call(makeEnv().env, 'GET', path)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'no_data' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects a first write whose verifyKey does not match the writeToken', async () => {
    const { env } = makeEnv()
    const a = await account()
    const b = await account()
    const res = await call(env, 'PUT', a.path, { blob: 'x', writeToken: a.writeToken, verifyKey: b.verifyKey })
    expect(res.status).toBe(400)
  })

  it('never overwrites existing data without a matching previousHash', async () => {
    const { env } = makeEnv()
    const a = await account()
    expect((await call(env, 'PUT', a.path, { blob: 'one', writeToken: a.writeToken, verifyKey: a.verifyKey })).status).toBe(200)

    // A second device that also saw "no data" sends another first write.
    const race = await call(env, 'PUT', a.path, { blob: 'two', writeToken: a.writeToken, verifyKey: a.verifyKey })
    expect(race.status).toBe(409)

    const stale = await call(env, 'PUT', a.path, { blob: 'two', writeToken: a.writeToken, previousHash: 'f'.repeat(64) })
    expect(stale.status).toBe(409)

    const ok = await call(env, 'PUT', a.path, { blob: 'two', writeToken: a.writeToken, previousHash: await sha256Hex('one') })
    expect(ok.status).toBe(200)
    expect(await (await call(env, 'GET', a.path)).json()).toMatchObject({ blob: 'two' })
  })

  it('lets exactly one of two simultaneous writes win', async () => {
    const { env } = makeEnv()
    const a = await account()
    await call(env, 'PUT', a.path, { blob: 'base', writeToken: a.writeToken, verifyKey: a.verifyKey })
    const previousHash = await sha256Hex('base')
    const results = await Promise.all(
      ['x', 'y'].map((blob) => call(env, 'PUT', a.path, { blob, writeToken: a.writeToken, previousHash }))
    )
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })

  it('rejects writes with the wrong token', async () => {
    const { env } = makeEnv()
    const a = await account()
    const other = await account()
    await call(env, 'PUT', a.path, { blob: 'one', writeToken: a.writeToken, verifyKey: a.verifyKey })
    const res = await call(env, 'PUT', a.path, {
      blob: 'evil',
      writeToken: other.writeToken,
      previousHash: await sha256Hex('one'),
    })
    expect(res.status).toBe(401)
  })

  it('imports data from the legacy KV layout once, then serves it from the Durable Object', async () => {
    const kv = new FakeKV()
    const { env } = makeEnv({ kv })
    const a = await account()
    const legacyHash = await sha256Hex('legacy-blob')
    await kv.put(
      a.address,
      JSON.stringify({ blob: 'legacy-blob', blobHash: legacyHash, verifyKey: a.verifyKey, updatedAt: '2026-01-01T00:00:00.000Z' })
    )

    const got = await (await call(env, 'GET', a.path)).json()
    expect(got).toMatchObject({ blob: 'legacy-blob', blobHash: legacyHash })
    expect(kv.map.has(a.address)).toBe(false)

    const put = await call(env, 'PUT', a.path, { blob: 'new', writeToken: a.writeToken, previousHash: legacyHash })
    expect(put.status).toBe(200)
  })

  it('stores large blobs in chunks and cleans up when they shrink', async () => {
    const { env, storages } = makeEnv()
    const a = await account()
    const big = 'a'.repeat(2_500_000)
    await call(env, 'PUT', a.path, { blob: big, writeToken: a.writeToken, verifyKey: a.verifyKey })
    expect(((await (await call(env, 'GET', a.path)).json()) as { blob: string }).blob).toBe(big)

    await call(env, 'PUT', a.path, { blob: 'small', writeToken: a.writeToken, previousHash: await sha256Hex(big) })
    expect(((await (await call(env, 'GET', a.path)).json()) as { blob: string }).blob).toBe('small')
    expect([...storages.get(a.address)!.map.keys()].sort()).toEqual(['chunk:0', 'meta'])
  })

  it('deletes data only with the right token', async () => {
    const kv = new FakeKV()
    const { env } = makeEnv({ kv })
    const a = await account()
    await call(env, 'PUT', a.path, { blob: 'one', writeToken: a.writeToken, verifyKey: a.verifyKey })

    expect((await call(env, 'DELETE', a.path, { writeToken: 'f'.repeat(64) })).status).toBe(401)
    expect((await call(env, 'DELETE', a.path, { writeToken: a.writeToken })).status).toBe(200)
    expect((await call(env, 'GET', a.path)).status).toBe(404)
  })

  it('enforces ALLOWED_ADDRESSES when configured', async () => {
    const a = await account()
    const b = await account()
    const { env } = makeEnv({ allowed: a.address })
    expect((await call(env, 'GET', a.path)).status).toBe(404)
    expect((await call(env, 'GET', b.path)).status).toBe(403)
  })

  it('rejects oversized uploads', async () => {
    const { env } = makeEnv()
    const a = await account()
    const res = await call(env, 'PUT', a.path, {
      blob: 'a'.repeat(20 * 1024 * 1024 + 1),
      writeToken: a.writeToken,
      verifyKey: a.verifyKey,
    })
    expect(res.status).toBe(413)
  })
})
