import { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { PipContext } from '@pip-it-up/react'
import type { Note } from '../types'
import { injectStyles } from '../content/styles'
import { errorMessage } from '../lib/notes'
import styles from './NoteEditor.module.css'

const AUTOSAVE_DELAY_MS = 500


interface NoteEditorProps {
  noteId: string
  /** Current stored copy of the note; undefined while a new note is being created or after deletion. */
  note: Note | undefined
  /** Contents a brand-new note is being created with, used until it reaches storage. */
  initialDraft?: { title: string; body: string }
  notesLoading: boolean
  /** False once the extension context is gone and nothing can be saved. */
  alive: boolean
  onSave: (id: string, updates: { title: string; body: string }, baseVersion?: number) => Promise<Note>
  onClose: () => void
  theme?: 'light' | 'dark'
  /** 'page' fills the screen (web app); 'inline' is the drawer fallback. */
  layout?: 'inline' | 'page'
  /** When given, a Delete button is shown in the header. */
  onDelete?: () => void
}

export function NoteEditor({
  noteId,
  note,
  initialDraft,
  notesLoading,
  alive,
  onSave,
  onClose,
  theme = 'light',
  layout = 'inline',
  onDelete,
}: NoteEditorProps) {
  // Initialize state from the note (when the component mounts for this key)
  // For a new note, start from the values it is being created with: typing can
  // begin before the note reaches storage, and must not save blank fields over them.
  const [title, setTitle] = useState(note?.title ?? initialDraft?.title ?? '')
  const [body, setBody] = useState(note?.body ?? initialDraft?.body ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  // True only for a brand-new note (not in storage yet when the editor opened).
  const [isNewNote] = useState(() => !!initialDraft && !note)
  const focusRef = useRef(isNewNote)

  const latestRef = useRef({ title, body })
  const isDirtyRef = useRef(false)
  const isGoneRef = useRef(false) // note deleted: never save again
  const hasSeenNoteRef = useRef(!!note)
  const baseVersionRef = useRef<number | undefined>(note ? note.version : initialDraft ? 1 : undefined)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())

  // Adopt external changes (sync, other tabs) unless the user has unsaved edits.
  useEffect(() => {
    if (!note) return
    hasSeenNoteRef.current = true
    if (!isDirtyRef.current) {
      setTitle(note.title)
      setBody(note.body)
      latestRef.current = { title: note.title, body: note.body }
      baseVersionRef.current = note.version
    }
  }, [note])

  // If the note was deleted (here, in another tab or via sync), close the editor.
  // A brand-new note isn't in storage yet, so only react once it has been seen.
  useEffect(() => {
    if (!notesLoading && !note && hasSeenNoteRef.current) {
      isGoneRef.current = true
      isDirtyRef.current = false
      onClose()
    }
  }, [note, notesLoading, onClose])

  // Saves are chained so each one sends the version the previous one produced.
  const save = useCallback((): Promise<void> => {
    const run = async () => {
      if (!isDirtyRef.current || isGoneRef.current) return
      const snapshot = latestRef.current
      try {
        const saved = await onSave(noteId, snapshot, baseVersionRef.current)
        baseVersionRef.current = saved.version
        // Only clear the flag if nothing was typed while this save was in flight.
        if (latestRef.current.title === snapshot.title && latestRef.current.body === snapshot.body) {
          isDirtyRef.current = false
        }
        setSaveError(null)
      } catch (e) {
        if (e instanceof Error && e.name === 'NoteDeletedError') {
          isGoneRef.current = true
          isDirtyRef.current = false
          return
        }
        setSaveError(errorMessage(e))
      }
    }
    saveChainRef.current = saveChainRef.current.then(run, run)
    return saveChainRef.current
  }, [noteId, onSave])

  // Debounced auto-save
  useEffect(() => {
    if (!isDirtyRef.current) return
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [title, body, save])

  // Flush on unmount, and when the page is being hidden or closed. With the
  // background owning storage, a flush is a single message that survives unload.
  useEffect(() => {
    const flush = () => void save()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [save])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    latestRef.current = { ...latestRef.current, title: e.target.value }
    isDirtyRef.current = true
  }

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    latestRef.current = { ...latestRef.current, body: e.target.value }
    isDirtyRef.current = true
  }

  // A new note opens with its placeholder title selected, so typing replaces it.
  useEffect(() => {
    if (notesLoading || !focusRef.current) return
    focusRef.current = false
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [notesLoading])

  // Get PiP context unconditionally to determine if we are inside the floating window
  const pipContext = useContext(PipContext)
  const isInsidePip = pipContext?.isInsidePip || false

  // When the editor moves into the PiP window, the wrapper focuses its first
  // button. Put the cursor where the user expects instead: a new note's title
  // (selected, so typing replaces it) or the end of the body.
  useEffect(() => {
    if (!isInsidePip) return
    const timer = setTimeout(() => {
      const isFreshDraft = isNewNote && latestRef.current.title === initialDraft?.title
      const target = isFreshDraft ? titleRef.current : bodyRef.current
      if (!target) return
      target.focus()
      if (isFreshDraft) target.select()
      else target.setSelectionRange(target.value.length, target.value.length)
    }, 0)
    return () => clearTimeout(timer)
    // Only on entering PiP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsidePip])

  useEffect(() => {
    const pipWindow = (window as Window & { documentPictureInPicture?: { window: Window | null } })
      .documentPictureInPicture?.window
    if (!isInsidePip || !pipWindow) return

    injectStyles(pipWindow.document, 'nid-pip-styles')

    // Keep PiP window body background matching the theme cleanly
    const bodyStyle = pipWindow.document.body.style
    bodyStyle.backgroundColor = theme === 'dark' ? '#2E303C' : '#FFFBF0'
    bodyStyle.margin = '0'
    bodyStyle.padding = '0'
    bodyStyle.overflow = 'hidden'
  }, [isInsidePip, theme])

  if (notesLoading) {
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
    <div className={`nid-overlay-root nid-theme-${theme} ${styles.editorContainer} ${isInsidePip ? styles.pipModeContainer : layout === 'page' ? styles.pageContainer : styles.inlineContainer}`}>
      {/* Drawer (no PiP available) and phone app; in PiP the window's own close button closes it. */}
      {!isInsidePip && (
        <div className={styles.editorHeader}>
          <span className={styles.headerText}>Editing note</span>
          <div className={styles.headerGroup}>
            {onDelete && (
              <button type="button" className={styles.headerBtn} onClick={onDelete} aria-label="Delete note" title="Delete note">
                🗑️
              </button>
            )}
            <button type="button" className={styles.headerBtn} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}

      {!alive && (
        <div className={styles.banner} role="alert">
          Note It Down was updated or reloaded, so changes here can't be saved. Copy any unsaved text,
          then reload this page.
        </div>
      )}
      {alive && saveError && (
        <div className={styles.banner} role="alert">
          Couldn't save: {saveError}
        </div>
      )}

      <input
        ref={titleRef}
        className={styles.titleInput}
        type="text"
        placeholder="Note title..."
        aria-label="Note title"
        value={title}
        onChange={handleTitleChange}
        readOnly={!alive}
      />

      <div className={styles.divider} />

      <textarea
        ref={bodyRef}
        className={styles.bodyTextarea}
        placeholder="Start writing..."
        aria-label="Note body"
        value={body}
        onChange={handleBodyChange}
        readOnly={!alive}
      />
    </div>
  )
}
