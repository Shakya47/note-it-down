import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Note } from '../types'
import {
  addNote,
  deleteNote,
  ExtensionContextInvalidatedError,
  isExtensionAlive,
  readNotes,
  updateNote,
} from '../lib/notesClient'
import { STORAGE_KEYS } from '../lib/messages'
import { isNoteArray, makeTombstone, sanitizeNotes } from '../lib/notes'

const ALIVE_CHECK_INTERVAL_MS = 2000

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [alive, setAlive] = useState<boolean>(isExtensionAlive)

  // Load notes on mount
  useEffect(() => {
    let isMounted = true
    readNotes()
      .then((allNotes) => {
        if (isMounted) setNotes(allNotes)
      })
      .catch((e: unknown) => {
        if (isMounted && e instanceof ExtensionContextInvalidatedError) setAlive(false)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Follow changes made by other tabs, the editor and background sync
  useEffect(() => {
    if (!isExtensionAlive()) return
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.notes]) {
        const next = changes[STORAGE_KEYS.notes].newValue
        setNotes(isNoteArray(next) ? sanitizeNotes(next) : [])
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      try {
        chrome.storage.onChanged.removeListener(handleStorageChange)
      } catch {
        // Extension context already gone; nothing to remove.
      }
    }
  }, [])

  // After an extension update/reload this page's copy of the script is orphaned
  // and every save would fail; detect it so the UI can say so.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isExtensionAlive()) {
        setAlive(false)
        clearInterval(timer)
      }
    }, ALIVE_CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const track = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    return promise.catch((e: unknown) => {
      if (e instanceof ExtensionContextInvalidatedError) setAlive(false)
      throw e
    })
  }, [])

  // Memoize visible notes: sorted by updatedAt descending
  const sortedNotes = useMemo(() => {
    return notes
      .filter((note) => !note.deleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes])

  const handleAddNote = useCallback(
    async (input: { id: string; title: string; body: string }) => {
      const newNote = await track(addNote(input))
      setNotes((prev) => (prev.some((n) => n.id === newNote.id) ? prev : [...prev, newNote]))
      return newNote
    },
    [track]
  )

  const handleUpdateNote = useCallback(
    async (id: string, updates: { title: string; body: string }, baseVersion?: number) => {
      const updatedNote = await track(updateNote(id, updates, baseVersion))
      setNotes((prev) => prev.map((n) => (n.id === id ? updatedNote : n)))
      return updatedNote
    },
    [track]
  )

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await track(deleteNote(id))
      const now = new Date().toISOString()
      setNotes((prev) => prev.map((n) => (n.id === id ? makeTombstone(n, now) : n)))
    },
    [track]
  )

  const reloadNotes = useCallback(async () => {
    try {
      const allNotes = await readNotes()
      setNotes(allNotes)
    } catch (e: unknown) {
      if (e instanceof ExtensionContextInvalidatedError) setAlive(false)
    }
  }, [])

  return {
    notes: sortedNotes,
    loading,
    alive,
    addNote: handleAddNote,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
    reloadNotes,
  }
}
