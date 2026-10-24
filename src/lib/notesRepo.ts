import type { Note } from '../types'
import type { SyncBase } from '../sync/merge'
import {
  isNoteArray,
  isValidNewNoteId,
  makeConflictCopy,
  makeTombstone,
  sanitizeNotes,
} from './notes'

/** Minimal key-value persistence a platform provides (chrome.storage, IndexedDB). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

/** Runs fn with exclusive access to the notes (one writer at a time). */
export type Lock = <T>(fn: () => Promise<T>) => Promise<T>

export const NOTES_KEY = 'notes'
export const SYNC_BASE_KEY = 'nid-sync-base'

/** In-process lock: a promise queue. */
export function createQueueLock(): Lock {
  let queue: Promise<unknown> = Promise.resolve()
  return <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn)
    queue = run.catch(() => {})
    return run
  }
}

export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Note ${id} not found`)
    this.name = 'NoteNotFoundError'
  }
}

export class NoteDeletedError extends Error {
  constructor(id: string) {
    super(`Note ${id} was deleted`)
    this.name = 'NoteDeletedError'
  }
}

export type NotesRepo = ReturnType<typeof createNotesRepo>

/**
 * Note storage and mutations, shared by the extension (chrome.storage) and the
 * web app (IndexedDB). Every read-modify-write runs under `lock`, so writes
 * from different tabs, the editor and sync can't overwrite each other.
 */
export function createNotesRepo(kv: KeyValueStore, lock: Lock) {
  let mutationListener: (() => void) | null = null
  let mutationCount = 0

  function markMutated() {
    mutationCount++
    mutationListener?.()
  }

  async function readNotes(): Promise<Note[]> {
    const notes = await kv.get(NOTES_KEY)
    return isNoteArray(notes) ? sanitizeNotes(notes) : []
  }

  async function writeNotes(notes: Note[]): Promise<void> {
    await kv.set(NOTES_KEY, notes)
  }

  async function readSyncBase(): Promise<SyncBase> {
    const base = await kv.get(SYNC_BASE_KEY)
    return base && typeof base === 'object' ? (base as SyncBase) : {}
  }

  async function writeSyncBase(notes: Note[]): Promise<void> {
    const base: SyncBase = {}
    for (const note of notes) base[note.id] = note.version ?? 0
    await kv.set(SYNC_BASE_KEY, base)
  }

  function addNote(input: { id: string; title: string; body: string }): Promise<Note> {
    return lock(async () => {
      if (!isValidNewNoteId(input.id)) throw new Error('Invalid note id')
      const notes = await readNotes()
      if (notes.some((n) => n.id === input.id)) throw new Error('A note with this id already exists')

      const now = new Date().toISOString()
      const note: Note = {
        id: input.id,
        title: input.title,
        body: input.body,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }
      await writeNotes([...notes, note])
      markMutated()
      return note
    })
  }

  /**
   * Updates a note. `baseVersion` is the version the editor last loaded: if the
   * note changed underneath it (another tab, or sync pulled a remote edit), the
   * other content is preserved as a conflict copy instead of being overwritten.
   */
  function updateNote(id: string, updates: { title: string; body: string }, baseVersion?: number): Promise<Note> {
    return lock(async () => {
      const notes = await readNotes()
      const index = notes.findIndex((n) => n.id === id)
      if (index === -1) throw new NoteNotFoundError(id)

      const existing = notes[index]
      if (existing.deleted) throw new NoteDeletedError(id)
      if (existing.title === updates.title && existing.body === updates.body) return existing

      const next = [...notes]
      const changedUnderneath = baseVersion !== undefined && (existing.version ?? 0) !== baseVersion
      if (changedUnderneath) {
        const copy = makeConflictCopy(existing)
        if (!next.some((n) => n.id === copy.id)) next.push(copy)
      }

      const updated: Note = {
        ...existing,
        title: updates.title,
        body: updates.body,
        updatedAt: new Date().toISOString(),
        version: (existing.version ?? 0) + 1,
        deleted: undefined,
      }
      next[index] = updated
      await writeNotes(next)
      markMutated()
      return updated
    })
  }

  function deleteNote(id: string): Promise<void> {
    return lock(async () => {
      const notes = await readNotes()
      const index = notes.findIndex((n) => n.id === id)
      if (index === -1 || notes[index].deleted) return

      const next = [...notes]
      next[index] = makeTombstone(notes[index], new Date().toISOString())
      await writeNotes(next)
      markMutated()
    })
  }

  return {
    withNotesLock: lock,
    readNotes,
    writeNotes,
    readSyncBase,
    writeSyncBase,
    addNote,
    updateNote,
    deleteNote,
    /** Called after every local (user-made) change to the notes. */
    onLocalMutation(listener: () => void) {
      mutationListener = listener
    },
    getMutationCount: () => mutationCount,
  }
}
