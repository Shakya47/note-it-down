import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, setFailWrites, switchStore, type FakeStore } from '../test/fakeChrome'
import { addNote, deleteNote, NoteDeletedError, readNotes, updateNote } from './notesStore'
import { generateId } from '../lib/notes'

installFakeChrome()

let store: FakeStore
beforeEach(() => {
  store = {}
  switchStore(store)
  setFailWrites(false)
})

describe('notesStore', () => {
  it('serialises concurrent writes so none are lost', async () => {
    const ids = Array.from({ length: 20 }, () => generateId())
    await Promise.all(ids.map((id) => addNote({ id, title: id, body: '' })))
    await Promise.all(ids.map((id) => updateNote(id, { title: id, body: 'edited' })))
    const notes = await readNotes()
    expect(notes).toHaveLength(20)
    expect(notes.every((n) => n.body === 'edited' && n.version === 2)).toBe(true)
  })

  it('keeps the other content as a conflict copy when the note changed underneath the editor', async () => {
    const id = generateId()
    const created = await addNote({ id, title: 'T', body: 'original' })
    await updateNote(id, { title: 'T', body: 'from another tab' }, created.version)

    // This editor still thinks it is editing version 1.
    await updateNote(id, { title: 'T', body: 'from this editor' }, created.version)

    const notes = await readNotes()
    expect(notes.find((n) => n.id === id)?.body).toBe('from this editor')
    expect(notes.find((n) => n.id !== id)?.body).toBe('from another tab')
  })

  it('refuses to bring a deleted note back', async () => {
    const id = generateId()
    await addNote({ id, title: 'T', body: 'x' })
    await deleteNote(id)
    await expect(updateNote(id, { title: 'T', body: 'late autosave' })).rejects.toBeInstanceOf(NoteDeletedError)
    expect((await readNotes())[0]).toMatchObject({ deleted: true, title: '', body: '' })
  })

  it('surfaces storage write failures instead of swallowing them', async () => {
    setFailWrites(true)
    await expect(addNote({ id: generateId(), title: 'T', body: '' })).rejects.toThrow(/quota/i)
  })

  it('rejects malformed or duplicate ids from content scripts', async () => {
    await expect(addNote({ id: 'not-a-uuid', title: 'T', body: '' })).rejects.toThrow(/invalid/i)
    const id = generateId()
    await addNote({ id, title: 'T', body: '' })
    await expect(addNote({ id, title: 'T', body: '' })).rejects.toThrow(/exists/i)
  })
})
