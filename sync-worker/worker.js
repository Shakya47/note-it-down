const SERVICE = 'note-it-down-sync';
const API_VERSION = 2;

// Largest encrypted blob accepted (base64 characters).
const MAX_BLOB_CHARS = 20 * 1024 * 1024;
// Durable Object storage values are capped at 2 MB, so blobs are stored in chunks.
const CHUNK_CHARS = 1_000_000;

const HEX_64 = /^[0-9a-f]{64}$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyWriteToken(verifyKeyHex, writeTokenHex) {
  if (!HEX_64.test(verifyKeyHex) || !HEX_64.test(writeTokenHex)) return false;
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    hexToBytes(verifyKeyHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode('nid-write-auth'));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqualHex(expectedHex, writeTokenHex);
}

async function readBody(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BLOB_CHARS + 4096) return { error: json({ error: 'payload too large' }, 413) };
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new Error('not an object');
    return { body };
  } catch {
    return { error: json({ error: 'Invalid JSON' }, 400) };
  }
}

function allowedAddresses(env) {
  if (!env.ALLOWED_ADDRESSES) return null;
  return new Set(
    String(env.ALLOWED_ADDRESSES)
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  );
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const { pathname } = new URL(request.url);

      if (pathname === '/v1/health' && request.method === 'GET') {
        return json({ service: SERVICE, version: API_VERSION });
      }

      const match = pathname.match(/^\/v1\/([a-fA-F0-9]{64})$/);
      if (!match) {
        // Deliberately not { error: 'not found' }: clients treat that as "no data yet".
        return json({ error: 'unknown route', code: 'bad_route' }, 404);
      }
      const address = match[1].toLowerCase();

      const allowed = allowedAddresses(env);
      if (allowed && !allowed.has(address)) {
        return json({ error: 'address not allowed' }, 403);
      }

      if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
        return json({ error: 'Method not allowed' }, 405);
      }

      // One Durable Object per address: strongly consistent storage, and all
      // requests for an address are processed one at a time, which makes the
      // compare-and-swap below atomic.
      const stub = env.NOTES_STORE.get(env.NOTES_STORE.idFromName(address));
      return await stub.fetch(new Request(`https://notes-store/${address}`, request));
    } catch {
      return json({ error: 'internal error' }, 500);
    }
  },
};

export class NotesStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
  }

  fetch(request) {
    // Serialise requests explicitly: the legacy KV import awaits non-storage
    // I/O, during which the runtime could otherwise interleave another request.
    const run = this.queue.then(() => this.handle(request));
    this.queue = run.catch(() => {});
    return run;
  }

  async handle(request) {
    try {
      const address = new URL(request.url).pathname.slice(1);
      if (request.method === 'GET') return await this.get(address);
      if (request.method === 'PUT') return await this.put(address, request);
      if (request.method === 'DELETE') return await this.remove(address, request);
      return json({ error: 'Method not allowed' }, 405);
    } catch {
      return json({ error: 'internal error' }, 500);
    }
  }

  async get(address) {
    const entry = await this.load(address);
    if (!entry) return json({ error: 'not found', code: 'no_data' }, 404);
    return json({ blob: entry.blob, blobHash: entry.blobHash, updatedAt: entry.updatedAt });
  }

  async put(address, request) {
    const { body, error } = await readBody(request);
    if (error) return error;

    const { blob, writeToken, verifyKey, previousHash } = body;
    if (typeof blob !== 'string' || !blob || typeof writeToken !== 'string') {
      return json({ error: 'Missing blob or writeToken' }, 400);
    }
    if (blob.length > MAX_BLOB_CHARS) return json({ error: 'payload too large' }, 413);

    const existing = await this.load(address);

    if (!existing) {
      // First write: the client registers its verifyKey. Check that the
      // writeToken matches it, so a malformed key can't lock the address.
      if (typeof verifyKey !== 'string' || !(await verifyWriteToken(verifyKey, writeToken))) {
        return json({ error: 'Missing or invalid verifyKey for first write' }, 400);
      }
      const blobHash = await this.save(blob, verifyKey);
      return json({ success: true, blobHash });
    }

    if (!(await verifyWriteToken(existing.verifyKey, writeToken))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Compare-and-swap. A missing previousHash means the client believed no
    // data existed (e.g. two devices setting up at once), which is a conflict
    // too — never an unconditional overwrite.
    if (typeof previousHash !== 'string' || previousHash !== existing.blobHash) {
      return json({ error: 'conflict', currentHash: existing.blobHash }, 409);
    }

    const blobHash = await this.save(blob, existing.verifyKey);
    return json({ success: true, blobHash });
  }

  async remove(address, request) {
    const { body, error } = await readBody(request);
    if (error) return error;

    const existing = await this.load(address);
    if (!existing) return json({ error: 'not found', code: 'no_data' }, 404);
    if (!(await verifyWriteToken(existing.verifyKey, body.writeToken))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    await this.ctx.storage.deleteAll();
    if (this.env.NOTES_KV) await this.env.NOTES_KV.delete(address);
    return json({ success: true });
  }

  async load(address) {
    const meta = await this.ctx.storage.get('meta');
    if (meta) {
      const keys = Array.from({ length: meta.chunkCount }, (_, i) => `chunk:${i}`);
      const chunks = await this.ctx.storage.get(keys);
      const blob = keys.map((key) => chunks.get(key) ?? '').join('');
      return { blob, blobHash: meta.blobHash, verifyKey: meta.verifyKey, updatedAt: meta.updatedAt };
    }
    return this.importLegacy(address);
  }

  /** One-time move of data written by the earlier KV-based worker. */
  async importLegacy(address) {
    if (!this.env.NOTES_KV) return null;
    const legacyStr = await this.env.NOTES_KV.get(address);
    if (!legacyStr) return null;

    const legacy = JSON.parse(legacyStr);
    if (typeof legacy.blob !== 'string' || typeof legacy.verifyKey !== 'string') return null;

    const blobHash = await this.save(legacy.blob, legacy.verifyKey, legacy.updatedAt);
    await this.env.NOTES_KV.delete(address);
    return { blob: legacy.blob, blobHash, verifyKey: legacy.verifyKey, updatedAt: legacy.updatedAt };
  }

  async save(blob, verifyKey, updatedAt = new Date().toISOString()) {
    const blobHash = await sha256Hex(blob);
    const previous = await this.ctx.storage.get('meta');

    const entries = {};
    let chunkCount = 0;
    for (let i = 0; i < blob.length; i += CHUNK_CHARS) {
      entries[`chunk:${chunkCount++}`] = blob.slice(i, i + CHUNK_CHARS);
    }
    entries.meta = { blobHash, verifyKey, updatedAt, chunkCount };
    await this.ctx.storage.put(entries); // atomic: all keys or none

    if (previous && previous.chunkCount > chunkCount) {
      const stale = [];
      for (let i = chunkCount; i < previous.chunkCount; i++) stale.push(`chunk:${i}`);
      await this.ctx.storage.delete(stale);
    }
    return blobHash;
  }
}
