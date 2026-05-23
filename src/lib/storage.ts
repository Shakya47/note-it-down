import type { Note } from '../types'

const STORAGE_KEY = 'notes'

// Helper to determine if we are running as a Chrome extension
const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage?.local !== undefined

/**
 * Retrieves the list of notes from storage (Chrome local storage or localStorage fallback)
 */
export async function getNotes(): Promise<Note[]> {
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const notes = result[STORAGE_KEY] as Note[] | undefined
        resolve(notes || [])
      })
    })
  } else {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? (JSON.parse(data) as Note[]) : []
    } catch (e) {
      return []
    }
  }
}

/**
 * Saves the list of notes to storage
 */
export async function saveNotes(notes: Note[]): Promise<void> {
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: notes }, () => {
        resolve()
      })
    })
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch (e) {}
  }
}

/**
 * Adds a new note to storage
 */
export async function addNote(noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  const notes = await getNotes()
  
  const now = new Date().toISOString()
  const newNote: Note = {
    id: crypto.randomUUID(),
    title: noteData.title,
    body: noteData.body,
    createdAt: now,
    updatedAt: now,
  }
  
  notes.push(newNote)
  await saveNotes(notes)
  return newNote
}

/**
 * Updates an existing note in storage
 */
export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Note> {
  const notes = await getNotes()
  const noteIndex = notes.findIndex((note) => note.id === id)
  
  if (noteIndex === -1) {
    throw new Error(`Note with id ${id} not found`)
  }
  
  const existingNote = notes[noteIndex]
  const updatedNote: Note = {
    ...existingNote,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  
  notes[noteIndex] = updatedNote
  await saveNotes(notes)
  return updatedNote
}

/**
 * Deletes a note from storage
 */
export async function deleteNote(id: string): Promise<void> {
  const notes = await getNotes()
  const filteredNotes = notes.filter((note) => note.id !== id)
  await saveNotes(filteredNotes)
}
