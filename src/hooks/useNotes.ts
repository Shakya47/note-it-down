import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Note } from '../types'
import { getNotes, addNote, updateNote, deleteNote } from '../lib/storage'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Load notes on mount
  useEffect(() => {
    let isMounted = true
    getNotes()
      .then((allNotes) => {
        if (isMounted) {
          setNotes(allNotes)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Listen to external storage updates (Chrome extension storage sync)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.notes) {
        setNotes((changes.notes.newValue as Note[]) || [])
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange)
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange)
      }
    }
  }, [])

  // Memoize sorted notes: sorted by updatedAt descending
  const sortedNotes = useMemo(() => {
    return [...notes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [notes])

  // Create note
  const handleAddNote = useCallback(async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote = await addNote(noteData)
    // Always update local state immediately to avoid race conditions with chrome.storage.onChanged
    setNotes((prev) => {
      if (prev.some((n) => n.id === newNote.id)) return prev
      return [...prev, newNote]
    })
    return newNote;
  }, [])

  // Update note
  const handleUpdateNote = useCallback(
    async (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const updatedNote = await updateNote(id, updates)
      // Always update local state immediately to avoid race conditions
      setNotes((prev) => prev.map((n) => (n.id === id ? updatedNote : n)))
      return updatedNote;
    },
    []
  )

  // Delete note
  const handleDeleteNote = useCallback(async (id: string) => {
    await deleteNote(id)
    // Always update local state immediately to avoid race conditions
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])



  return {
    notes: sortedNotes,
    loading,
    addNote: handleAddNote,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
  }
}
