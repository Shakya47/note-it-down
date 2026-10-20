import type { Note } from '../types'

export const CONFLICT_TITLE_PREFIX = '⚠️ [CONFLICT] '

/**
 * Older clients soft-deleted notes without clearing their content. Treat those
 * as live notes so their content is never silently hidden.
 */
export function sanitizeNote(note: Note): Note {
  if (note.deleted && (note.title !== '' || note.body !== '')) {
    return { ...note, deleted: undefined }
  }
  return note
}

export function sanitizeNotes(notes: Note[]): Note[] {
  return notes.map(sanitizeNote)
}

export function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false
  const n = value as Record<string, unknown>
  return (
    typeof n.id === 'string' &&
    n.id !== '' &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.createdAt === 'string' &&
    typeof n.updatedAt === 'string' &&
    (n.version === undefined || typeof n.version === 'number') &&
    (n.deleted === undefined || typeof n.deleted === 'boolean')
  )
}

export function isNoteArray(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every(isNote)
}

/** True when two copies of a note carry the same user-visible state. */
export function sameContent(a: Note, b: Note): boolean {
  return a.title === b.title && a.body === b.body && !!a.deleted === !!b.deleted
}

export function makeTombstone(note: Note, now: string): Note {
  return {
    id: note.id,
    title: '',
    body: '',
    createdAt: note.createdAt,
    updatedAt: now,
    version: (note.version ?? 0) + 1,
    deleted: true,
  }
}

/**
 * Builds a conflict copy of `loser`. The id is derived from the loser's
 * version and timestamp so that every device resolving the same conflict
 * produces the same id, and repeated conflicts on one note never collide.
 */
export function makeConflictCopy(loser: Note): Note {
  const stamp = Date.parse(loser.updatedAt) || 0
  return {
    ...loser,
    id: `${loser.id}_conflict_${loser.version ?? 0}_${stamp}`,
    title: `${CONFLICT_TITLE_PREFIX}${loser.title}`,
    version: 1,
    deleted: undefined,
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isValidNewNoteId(id: unknown): id is string {
  return typeof id === 'string' && UUID_PATTERN.test(id)
}

/**
 * UUID v4 built from getRandomValues, which (unlike crypto.randomUUID) is also
 * available to content scripts running on plain http:// pages.
 */
export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Order-independent serialisation used to detect "nothing changed". */
export function canonicalize(notes: Note[]): string {
  return JSON.stringify(
    [...notes]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((n) => [n.id, n.title, n.body, n.createdAt, n.updatedAt, n.version ?? 0, !!n.deleted])
  )
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
