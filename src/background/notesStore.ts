import { createNotesRepo, createQueueLock } from '../lib/notesRepo'

export { NoteDeletedError, NoteNotFoundError } from '../lib/notesRepo'

// The background service worker is the only writer of the notes array; the
// queue lock serialises every read-modify-write within it.
const repo = createNotesRepo(
  {
    get: async (key) => (await chrome.storage.local.get(key))[key],
    // The promise API rejects if the write fails (e.g. quota exceeded).
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
  },
  createQueueLock()
)

export const {
  withNotesLock,
  readNotes,
  writeNotes,
  readSyncBase,
  writeSyncBase,
  addNote,
  updateNote,
  deleteNote,
  onLocalMutation,
  getMutationCount,
} = repo
export { repo as notesRepo }
