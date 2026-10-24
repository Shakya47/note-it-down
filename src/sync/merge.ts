import type { Note } from '../types';
import { makeConflictCopy, sameContent, sanitizeNote } from '../lib/notes';

/** Version of each note as of the last successful sync (the common ancestor). */
export type SyncBase = Record<string, number>;

/**
 * Three-way merge of local and remote notes.
 *
 * Rules, per note id:
 * 1. Only on one side -> keep it.
 * 2. Same content on both sides -> keep the copy with the higher version.
 * 3. Base version known:
 *    - only local changed since the last sync  -> keep local
 *    - only remote changed since the last sync -> keep remote
 *    - both changed                            -> concurrent edit (rule 5)
 * 4. No base version (device has never synced this note with this client
 *    version) -> the higher version wins; equal versions -> concurrent edit.
 * 5. Concurrent edit:
 *    - an edit beats a deletion (no content is lost)
 *    - otherwise the later updatedAt wins and the other copy is kept as a
 *      conflict copy with a deterministic id.
 *    The surviving note gets a version above both sides so every device
 *    treats it as the newest copy.
 */
export function mergeNotes(localNotes: Note[], remoteNotes: Note[], base: SyncBase = {}): Note[] {
  const localMap = new Map<string, Note>();
  for (const note of localNotes) localMap.set(note.id, sanitizeNote(note));

  const remoteMap = new Map<string, Note>();
  for (const note of remoteNotes) remoteMap.set(note.id, sanitizeNote(note));

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const result = new Map<string, Note>();
  const conflictCopies: Note[] = [];

  const resolveConcurrent = (local: Note, remote: Note) => {
    const version = Math.max(local.version ?? 0, remote.version ?? 0) + 1;

    if (local.deleted && !remote.deleted) return { ...remote, version };
    if (remote.deleted && !local.deleted) return { ...local, version };

    const [winner, loser] = pickWinner(local, remote);
    if (!loser.deleted) conflictCopies.push(makeConflictCopy(loser));
    return { ...winner, version };
  };

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (!local || !remote) {
      result.set(id, (local ?? remote)!);
      continue;
    }

    const localVer = local.version ?? 0;
    const remoteVer = remote.version ?? 0;

    if (sameContent(local, remote)) {
      result.set(id, localVer >= remoteVer ? local : remote);
      continue;
    }

    const baseVer = base[id];
    if (baseVer !== undefined) {
      const localChanged = localVer !== baseVer;
      const remoteChanged = remoteVer !== baseVer;
      if (localChanged && !remoteChanged) {
        result.set(id, local);
      } else if (remoteChanged && !localChanged) {
        result.set(id, remote);
      } else {
        result.set(id, resolveConcurrent(local, remote));
      }
    } else if (localVer > remoteVer) {
      result.set(id, local);
    } else if (remoteVer > localVer) {
      result.set(id, remote);
    } else {
      result.set(id, resolveConcurrent(local, remote));
    }
  }

  // A conflict copy whose id already exists was produced by an earlier merge
  // of the same conflict; the stored copy (possibly edited since) wins.
  for (const copy of conflictCopies) {
    if (!result.has(copy.id)) result.set(copy.id, copy);
  }

  return [...result.values()];
}

/** Later updatedAt wins; ties are broken on content so every device agrees. */
function pickWinner(a: Note, b: Note): [Note, Note] {
  const aTime = Date.parse(a.updatedAt) || 0;
  const bTime = Date.parse(b.updatedAt) || 0;
  if (aTime !== bTime) return aTime > bTime ? [a, b] : [b, a];
  const aKey = `${a.title}\u0000${a.body}`;
  const bKey = `${b.title}\u0000${b.body}`;
  return aKey >= bKey ? [a, b] : [b, a];
}
