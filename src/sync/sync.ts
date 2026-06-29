import { deriveKeys, decrypt, encrypt } from './crypto';
import { mergeNotes } from './merge';
import { getNotes, saveNotes } from '../lib/storage';
import type { Note } from '../types';

export interface SyncResult {
  success: boolean;
  syncedAt?: string; // ISO timestamp, present on success
  error?: string; // human-readable error, present on failure
}

/**
 * Syncs the local note database with the remote user-deployed Cloudflare Worker.
 * Handles key derivation, encryption/decryption, conflict resolution via merge,
 * and optimistic lock / conflict retry logic (409).
 *
 * @param serverUrl - The base URL of the user-deployed worker
 * @param token - The user-generated secret token
 */
export async function sync(serverUrl: string, token: string): Promise<SyncResult> {
  try {
    const normalizedServerUrl = serverUrl.replace(/\/+$/, '');

    // 1. Derive keys
    let keys;
    try {
      keys = await deriveKeys(token);
    } catch (e: any) {
      return { success: false, error: `Key derivation failed: ${e.message}` };
    }

    const { encryptionKey, address, writeToken, verifyKey } = keys;

    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;

      // 2. Fetch remote
      let remoteBlob: string | undefined = undefined;
      let remoteBlobHash: string | undefined = undefined;
      let isFirstWrite = false;

      const getUrl = `${normalizedServerUrl}/v1/${address}`;
      let getRes: Response;
      try {
        getRes = await fetch(getUrl, { method: 'GET' });
      } catch (e: any) {
        return { success: false, error: `Network error: ${e.message}` };
      }

      if (getRes.status === 404) {
        remoteBlob = undefined;
        remoteBlobHash = undefined;
        isFirstWrite = true;
      } else if (getRes.status === 200) {
        let remoteData;
        try {
          remoteData = await getRes.json();
        } catch (e: any) {
          return { success: false, error: 'Server error: invalid JSON response from GET' };
        }
        remoteBlob = remoteData.blob;
        remoteBlobHash = remoteData.blobHash;
        if (!remoteBlob) {
          return { success: false, error: 'Server error: missing blob in GET response' };
        }
      } else {
        return { success: false, error: `Server error: GET returned status ${getRes.status}` };
      }

      // 3. Decrypt remote blob
      let remoteNotes: Note[] = [];
      if (remoteBlob) {
        try {
          const decrypted = await decrypt(remoteBlob, encryptionKey);
          remoteNotes = JSON.parse(decrypted);
        } catch (e: any) {
          return { success: false, error: 'Decryption failed — wrong token?' };
        }
      }

      // 4. Read local notes
      let localNotes: Note[];
      try {
        localNotes = await getNotes();
      } catch (e: any) {
        return { success: false, error: `Local storage read error: ${e.message}` };
      }

      // 5. Merge
      const merged = mergeNotes(localNotes, remoteNotes);

      // 6. Save merged
      try {
        await saveNotes(merged);
      } catch (e: any) {
        return { success: false, error: `Local storage save error: ${e.message}` };
      }

      // 7. Encrypt merged
      let encryptedBlob: string;
      try {
        encryptedBlob = await encrypt(JSON.stringify(merged), encryptionKey);
      } catch (e: any) {
        return { success: false, error: `Encryption failed: ${e.message}` };
      }

      // 8. PUT to worker
      const putUrl = `${normalizedServerUrl}/v1/${address}`;
      const putBody: any = {
        blob: encryptedBlob,
        writeToken,
      };
      if (isFirstWrite) {
        putBody.verifyKey = verifyKey;
      } else if (remoteBlobHash) {
        putBody.previousHash = remoteBlobHash;
      }

      let putRes: Response;
      try {
        putRes = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(putBody),
        });
      } catch (e: any) {
        return { success: false, error: `Network error on upload: ${e.message}` };
      }

      if (putRes.status === 200) {
        return { success: true, syncedAt: new Date().toISOString() };
      } else if (putRes.status === 409) {
        // 9. Handle 409 Conflict (retry)
        if (attempt < maxAttempts) {
          continue;
        } else {
          return { success: false, error: 'Sync conflict could not be resolved after retry' };
        }
      } else if (putRes.status === 401) {
        return { success: false, error: 'Server error: 401 Unauthorized' };
      } else {
        return { success: false, error: `Server error: PUT returned status ${putRes.status}` };
      }
    }

    return { success: false, error: 'Unexpected loop termination' };
  } catch (e: any) {
    return { success: false, error: `Unhandled error: ${e.message}` };
  }
}
