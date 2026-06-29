import type { Note } from '../types';

/**
 * Merges two arrays of Note objects using last-write-wins per note,
 * with conflict flagging for same-version divergence.
 *
 * Rules:
 * 1. Note ID only in local -> Include as-is.
 * 2. Note ID only in remote -> Include as-is.
 * 3. Same ID, different version -> Keep the copy with the higher version.
 * 4. Same ID, same version, identical title + body -> Keep one copy.
 * 5. Same ID, same version, different title or body -> Keep both:
 *    - The one with the later updatedAt as the "winner"
 *    - A conflict copy with id: originalId + "_conflict" and title prefixed with "⚠️ [CONFLICT] "
 */
export function mergeNotes(localNotes: Note[], remoteNotes: Note[]): Note[] {
  const result: Note[] = [];

  const localMap = new Map<string, Note>();
  for (const note of localNotes) {
    localMap.set(note.id, note);
  }

  const remoteMap = new Map<string, Note>();
  for (const note of remoteNotes) {
    remoteMap.set(note.id, note);
  }

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localNote = localMap.get(id);
    const remoteNote = remoteMap.get(id);

    if (localNote && !remoteNote) {
      result.push(localNote);
    } else if (!localNote && remoteNote) {
      result.push(remoteNote);
    } else if (localNote && remoteNote) {
      const localVer = localNote.version ?? 0;
      const remoteVer = remoteNote.version ?? 0;

      if (localVer > remoteVer) {
        result.push(localNote);
      } else if (remoteVer > localVer) {
        result.push(remoteNote);
      } else {
        // Same version
        const isContentIdentical =
          localNote.title === remoteNote.title && localNote.body === remoteNote.body;

        if (isContentIdentical) {
          // Keep one copy, prefer local (they are identical content anyway)
          result.push(localNote);
        } else {
          // Divergent content at same version -> Conflict!
          // Tiebreaker on updatedAt to determine the winner
          const localTime = new Date(localNote.updatedAt).getTime();
          const remoteTime = new Date(remoteNote.updatedAt).getTime();

          let winner: Note;
          let loser: Note;

          if (localTime >= remoteTime) {
            winner = localNote;
            loser = remoteNote;
          } else {
            winner = remoteNote;
            loser = localNote;
          }

          // Keep winner as-is
          result.push(winner);

          // Keep loser as conflict copy
          const conflictNote: Note = {
            ...loser,
            id: `${id}_conflict`,
            title: `⚠️ [CONFLICT] ${loser.title}`,
          };
          result.push(conflictNote);
        }
      }
    }
  }

  return result;
}
