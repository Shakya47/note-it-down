import { describe, expect, it } from 'vitest'
import { mergeNotes } from './merge'
import type { Note } from '../types'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'X',
  title: 't',
  body: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  ...overrides,
})

const byId = (notes: Note[]) => Object.fromEntries(notes.map((n) => [n.id, n]))

describe('mergeNotes', () => {
  it('keeps notes that exist on only one side', () => {
    const merged = mergeNotes([note({ id: 'L' })], [note({ id: 'R' })])
    expect(Object.keys(byId(merged)).sort()).toEqual(['L', 'R'])
  })

  it('keeps the higher version when content is identical', () => {
    const merged = mergeNotes([note({ version: 2 })], [note({ version: 3 })])
    expect(merged).toHaveLength(1)
    expect(merged[0].version).toBe(3)
  })

  it('takes whichever side changed since the last sync', () => {
    const base = { X: 1 }
    const onlyLocal = mergeNotes([note({ version: 4, body: 'local' })], [note({ version: 1 })], base)
    expect(onlyLocal).toEqual([expect.objectContaining({ body: 'local', version: 4 })])

    const onlyRemote = mergeNotes([note({ version: 1 })], [note({ version: 2, body: 'remote' })], base)
    expect(onlyRemote).toEqual([expect.objectContaining({ body: 'remote', version: 2 })])
  })

  it('keeps both edits when both sides changed, even with different version counts', () => {
    // Device A autosaved five times (v6), device B edited once later (v2).
    const merged = mergeNotes(
      [note({ version: 6, body: 'A edits', updatedAt: '2026-01-02T10:00:00.000Z' })],
      [note({ version: 2, body: 'B edit (newer)', updatedAt: '2026-01-02T11:00:00.000Z' })],
      { X: 1 }
    )
    const notes = byId(merged)
    expect(notes.X).toMatchObject({ body: 'B edit (newer)', version: 7 })
    const copies = merged.filter((n) => n.id !== 'X')
    expect(copies).toHaveLength(1)
    expect(copies[0]).toMatchObject({ body: 'A edits', title: '⚠️ [CONFLICT] t', version: 1 })
    expect(copies[0].deleted).toBeUndefined()
  })

  it('falls back to higher-version-wins when there is no base (first sync after upgrade)', () => {
    const merged = mergeNotes([note({ version: 5, body: 'local' })], [note({ version: 2, body: 'remote' })])
    expect(merged).toEqual([expect.objectContaining({ body: 'local', version: 5 })])
  })

  it('lets an edit beat a concurrent delete without leaving a junk conflict note', () => {
    const merged = mergeNotes(
      [note({ version: 2, title: '', body: '', deleted: true, updatedAt: '2026-01-02T09:00:00.000Z' })],
      [note({ version: 2, body: 'edited', updatedAt: '2026-01-02T08:00:00.000Z' })]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ body: 'edited', version: 3 })
    expect(merged[0].deleted).toBeUndefined()
  })

  it('never produces duplicate ids when a note conflicts more than once', () => {
    const round1 = mergeNotes(
      [note({ version: 3, body: 'local1', updatedAt: '2026-01-03T10:00:00.000Z' })],
      [note({ version: 3, body: 'remote1', updatedAt: '2026-01-03T09:00:00.000Z' })]
    )
    const x = round1.find((n) => n.id === 'X')!
    const others = round1.filter((n) => n.id !== 'X')
    const version = (x.version ?? 0) + 1

    // Both devices edit the same note again before syncing.
    const round2 = mergeNotes(
      [{ ...x, body: 'local2', version, updatedAt: '2026-01-03T11:00:00.000Z' }, ...others],
      [{ ...x, body: 'remote2', version, updatedAt: '2026-01-03T10:30:00.000Z' }, ...others]
    )
    const ids = round2.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(round2.map((n) => n.body).sort()).toEqual(['local2', 'remote1', 'remote2'])
  })

  it('resolves ties identically on both devices', () => {
    const a = note({ version: 2, body: 'aaa' })
    const b = note({ version: 2, body: 'bbb' })
    const onA = byId(mergeNotes([a], [b]))
    const onB = byId(mergeNotes([b], [a]))
    expect(onA).toEqual(onB)
  })

  it('does not recreate a conflict copy that was already merged and then edited', () => {
    const local = note({ version: 6, body: 'A', updatedAt: '2026-01-02T10:00:00.000Z' })
    const remote = note({ version: 2, body: 'B', updatedAt: '2026-01-02T11:00:00.000Z' })
    const first = mergeNotes([local], [remote], { X: 1 })
    const copy = first.find((n) => n.id !== 'X')!
    const editedCopy = { ...copy, body: 'A (tidied up)', version: 2 }

    // Same conflict seen again (e.g. merged by a retry) alongside the edited copy.
    const again = mergeNotes([local, editedCopy], [remote], { X: 1 })
    expect(again.find((n) => n.id === copy.id)?.body).toBe('A (tidied up)')
  })

  it('treats legacy soft-deleted notes that still have content as live', () => {
    const merged = mergeNotes([note({ deleted: true, body: 'still here' })], [])
    expect(merged[0].deleted).toBeUndefined()
  })
})
