import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Note } from '../../src/types'
import { NOTES_KEY } from '../../src/lib/notesRepo'
import { onStorageChange, repo } from './storage'

export function useWebNotes() {
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const reload = () =>
      repo
        .readNotes()
        .then((notes) => {
          if (mounted) setAllNotes(notes)
        })
        .catch((e: unknown) => {
          if (mounted) setLoadError(e instanceof Error ? e.message : String(e))
        })
    reload().finally(() => {
      if (mounted) setLoading(false)
    })
    // Edits, sync and other tabs all write through storage; follow them.
    const unsubscribe = onStorageChange((key) => {
      if (key === NOTES_KEY) void reload()
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => !n.deleted)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [allNotes]
  )

  const updateNote = useCallback(
    (id: string, updates: { title: string; body: string }, baseVersion?: number) =>
      repo.updateNote(id, updates, baseVersion),
    []
  )

  return {
    notes,
    loading,
    loadError,
    addNote: repo.addNote,
    updateNote,
    deleteNote: repo.deleteNote,
  }
}
