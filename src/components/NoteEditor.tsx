import { useState, useEffect, useRef, useContext } from 'react'
import { PipContext } from '@pip-it-up/react'
import { useNotes } from '../hooks/useNotes'
import type { Note } from '../types'
import styles from './NoteEditor.module.css'

interface NoteEditorProps {
  noteId: string
  onClose: () => void
  notes?: Note[]
  updateNote?: (
    id: string,
    updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<Note>

  theme?: 'light' | 'dark'
}

export function NoteEditor({
  noteId,
  onClose,
  notes: propNotes,
  updateNote: propUpdateNote,

  theme = 'light',
}: NoteEditorProps) {

  const notesHook = useNotes()
  const notes = propNotes ?? notesHook.notes
  const updateNote = propUpdateNote ?? notesHook.updateNote
  const note = notes.find((n) => n.id === noteId)

  // Initialize state from the note (when the component mounts for this key)
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')


  const isDirtyRef = useRef(false)
  const isDeletedRef = useRef(false)

  useEffect(() => {
    if (!isDirtyRef.current && note) {
      setTitle(note.title)
      setBody(note.body)
    }
  }, [note])

  // Keep track of latest values in a ref for safe auto-saving on unmount
  const latestStateRef = useRef({ title, body, noteId })
  useEffect(() => {
    latestStateRef.current = { title, body, noteId }
  }, [title, body, noteId])

  // If the note was deleted externally, close the editor
  useEffect(() => {
    if (!notesHook.loading && !note && !isDeletedRef.current) {
      onClose()
    }
  }, [note, notesHook.loading, onClose])

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirtyRef.current) return

    const timer = setTimeout(async () => {
      try {
        await updateNote(noteId, { title, body })

        isDirtyRef.current = false
      } catch (err) {}
    }, 500)

    return () => clearTimeout(timer)
  }, [title, body, noteId, updateNote])

  // Flush saving on unmount
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && !isDeletedRef.current) {
        const { title: t, body: b, noteId: nid } = latestStateRef.current
        updateNote(nid, { title: t, body: b }).catch(() => {})
      }
    }
  }, [updateNote])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    isDirtyRef.current = true

  }

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    isDirtyRef.current = true

  }

  // Get PiP context unconditionally to determine if we are inside the floating window
  const pipContext = useContext(PipContext)
  const isInsidePip = pipContext?.isInsidePip || false

  useEffect(() => {
    const win = window as any
    if (isInsidePip && typeof win.documentPictureInPicture !== 'undefined') {
      const pipWindow = win.documentPictureInPicture.window
      if (pipWindow) {


        // Prevent duplicate stylesheet injection
        if (!pipWindow.document.getElementById('nid-pip-styles')) {
          const link = pipWindow.document.createElement('link')
          link.id = 'nid-pip-styles'
          link.rel = 'stylesheet'
          link.href = chrome.runtime.getURL('content.css')
          pipWindow.document.head.appendChild(link)

        }

        // Keep PiP window body background matching the theme cleanly
        const themeBgColor = theme === 'dark' ? '#2E303C' : '#FFFBF0'
        pipWindow.document.body.style.backgroundColor = themeBgColor
        pipWindow.document.body.style.margin = '0'
        pipWindow.document.body.style.padding = '0'
        pipWindow.document.body.style.overflow = 'hidden'
      }
    }
  }, [isInsidePip, theme])

  if (notesHook.loading) {
    return (
      <div className={`nid-overlay-root nid-theme-${theme} ${styles.editorContainer}`}>
        <div className={styles.loadingContainer}>
          <span className={styles.loadingEmoji}>⏳</span>
          <p className={styles.loadingText}>Fetching note details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`nid-overlay-root nid-theme-${theme} ${styles.editorContainer} ${isInsidePip ? styles.pipModeContainer : ''}`}>


      <input
        className={styles.titleInput}
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={handleTitleChange}
      />

      <div className={styles.divider} />

      <textarea
        className={styles.bodyTextarea}
        placeholder="Start writing..."
        value={body}
        onChange={handleBodyChange}
      />


    </div>
  )
}
