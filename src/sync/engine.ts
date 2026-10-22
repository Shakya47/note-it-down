import { deriveKeys, decrypt, encrypt } from './crypto';
import { mergeNotes } from './merge';
import { normalizeServerUrl, type SyncConfig } from './config';
import type { NotesRepo } from '../lib/notesRepo';
import { canonicalize, errorMessage, isNoteArray } from '../lib/notes';
import type { SyncResult, WorkerCheck } from '../lib/messages';
import type { Note } from '../types';

const MAX_ATTEMPTS = 3;
const WORKER_SERVICE = 'note-it-down-sync';

interface RemoteState {
  notes: Note[];
  hash: string | null; // null: nothing stored on the server yet
}

/**
 * Syncs local notes with the user-deployed worker: fetch, decrypt, three-way
 * merge against the last-synced versions, save locally, encrypt and upload
 * with a compare-and-swap on the previous blob hash (retrying on 409).
 * `repo` is the platform's note storage (extension background or web app).
 */
export async function syncNotes(
  config: SyncConfig,
  repo: Pick<NotesRepo, 'withNotesLock' | 'readNotes' | 'writeNotes' | 'readSyncBase' | 'writeSyncBase'>
): Promise<SyncResult> {
  try {
    const baseUrl = normalizeServerUrl(config.serverUrl);
    const { encryptionKey, address, writeToken, verifyKey } = await deriveKeys(config.token);
    const endpoint = `${baseUrl}/v1/${address}`;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const remote = await fetchRemote(endpoint, encryptionKey);

      // Read, merge and save under the notes lock so a local edit can't land
      // between the read and the write and get overwritten.
      const merged = await repo.withNotesLock(async () => {
        const local = await repo.readNotes();
        const result = mergeNotes(local, remote.notes, await repo.readSyncBase());
        if (canonicalize(result) !== canonicalize(local)) await repo.writeNotes(result);
        return result;
      });

      // Nothing new to upload: skip the write (saves quota and avoids
      // invalidating other devices' previousHash).
      if (remote.hash !== null && canonicalize(merged) === canonicalize(remote.notes)) {
        await repo.writeSyncBase(merged);
        return { success: true, syncedAt: new Date().toISOString() };
      }

      const blob = await encrypt(JSON.stringify(merged), encryptionKey);
      const body =
        remote.hash === null
          ? { blob, writeToken, verifyKey }
          : { blob, writeToken, previousHash: remote.hash };

      const res = await request(endpoint, 'uploading', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 200) {
        await repo.writeSyncBase(merged);
        return { success: true, syncedAt: new Date().toISOString() };
      }
      if (res.status === 409) continue; // someone else wrote first: re-fetch and re-merge
      throw await httpError(res, 'upload');
    }

    return { success: false, error: 'Other devices kept changing the data; will retry on the next sync' };
  } catch (e) {
    return { success: false, error: errorMessage(e) };
  }
}

/** Permanently deletes this token's data from the worker. */
export async function deleteRemote(config: SyncConfig): Promise<void> {
  const baseUrl = normalizeServerUrl(config.serverUrl);
  const { address, writeToken } = await deriveKeys(config.token);
  const res = await request(`${baseUrl}/v1/${address}`, 'deleting', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writeToken }),
  });
  if (res.status === 200) return;
  if (res.status === 404 && (await isNoDataResponse(res))) return;
  if (res.status === 405) {
    throw new Error('Your worker is an older version that cannot delete data. Redeploy the latest worker.');
  }
  throw await httpError(res, 'delete');
}

/**
 * Confirms the URL points at a Note It Down worker. 'legacy' means an older
 * worker without the health endpoint (it still works, but should be redeployed).
 */
export async function checkWorker(serverUrl: string): Promise<WorkerCheck> {
  const baseUrl = normalizeServerUrl(serverUrl);
  const res = await request(`${baseUrl}/v1/health`, 'contacting the worker', { method: 'GET' });
  const body = await readJson(res);
  if (res.status === 200 && field(body, 'service') === WORKER_SERVICE) return 'ok';
  if (res.status === 404 && field(body, 'error') === 'not found') return 'legacy';
  throw new Error(`That URL doesn't look like a Note It Down sync worker (status ${res.status})`);
}

async function fetchRemote(endpoint: string, key: CryptoKey): Promise<RemoteState> {
  const res = await request(endpoint, 'downloading', { method: 'GET' });

  if (res.status === 404) {
    // Only trust a 404 that comes from the worker itself; a 404 page from
    // some other server must not be mistaken for "no data yet".
    if (await isNoDataResponse(res)) return { notes: [], hash: null };
    throw new Error("Worker URL doesn't point to a Note It Down sync worker (404)");
  }
  if (res.status !== 200) throw await httpError(res, 'download');

  const body = await readJson(res);
  const blob = field(body, 'blob');
  const hash = field(body, 'blobHash');
  if (typeof blob !== 'string' || typeof hash !== 'string') {
    throw new Error('Server error: malformed response from the worker');
  }

  let notes: unknown;
  try {
    notes = JSON.parse(await decrypt(blob, key));
  } catch {
    throw new Error('Decryption failed — wrong token?');
  }
  if (!isNoteArray(notes)) throw new Error('Server data is not a valid notes list');
  return { notes, hash };
}

async function request(url: string, action: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch (e) {
    throw new Error(`Network error while ${action}: ${errorMessage(e)}`, { cause: e });
  }
}

async function isNoDataResponse(res: Response): Promise<boolean> {
  const body = await readJson(res);
  // New workers send code 'no_data'; older ones only { error: 'not found' }.
  return field(body, 'code') === 'no_data' || (field(body, 'code') === undefined && field(body, 'error') === 'not found');
}

async function httpError(res: Response, action: string): Promise<Error> {
  const detail = field(await readJson(res), 'error');
  if (res.status === 401) return new Error('Server rejected the write (401 Unauthorized)');
  if (res.status === 403) return new Error('This sync ID is not allowed by the worker (403)');
  if (res.status === 413) return new Error('Your notes are too large for the worker (413)');
  return new Error(`Server error during ${action}: ${res.status}${typeof detail === 'string' ? ` ${detail}` : ''}`);
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.clone().json();
  } catch {
    return undefined;
  }
}

function field(body: unknown, name: string): unknown {
  return body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : undefined;
}
