import { useState, useEffect, useCallback, forwardRef, type ComponentPropsWithoutRef } from 'react'
import { PipWrapper } from '@pip-it-up/react'
import { NoteEditor } from '../components/NoteEditor'
import { NoteList } from '../components/NoteList'
import { useNotes } from '../hooks/useNotes'
import { SyncStatusPanel } from '../ui/settings/SyncStatusPanel'
import { sendToBackground } from '../lib/notesClient'
import { STORAGE_KEYS } from '../lib/messages'
import { errorMessage, generateId } from '../lib/notes'

interface EditorOverlayProps {
  registerToggle: (toggleFn: () => void) => void
}

// Origin element for PipWrapper. Since @pip-it-up 0.2 it is a real layout box,
// so it gets a class to collapse it while it holds no editor.
const EditorSlot = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>((props, ref) => (
  <div ref={ref} {...props} className="nid-editor-slot" />
))

function EmptyPlaceholder() {
  return <div style={{ display: 'none' }} />
}

export function EditorOverlay({ registerToggle }: EditorOverlayProps) {
  const {
    notes,
    loading,
    alive,
    addNote,
    updateNote,
    deleteNote,
    reloadNotes,
  } = useNotes()

  const [isOpen, setIsOpen] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [activeTab, setActiveTab] = useState<'notes' | 'sync'>('notes')
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ id: string; title: string; body: string } | null>(null)

  // Load saved theme on mount
  useEffect(() => {
    chrome.storage.local
      .get(STORAGE_KEYS.theme)
      .then((result) => {
        const saved = result[STORAGE_KEYS.theme]
        if (saved === 'dark' || saved === 'light') setTheme(saved)
      })
      .catch(() => {})
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    chrome.storage.local.set({ [STORAGE_KEYS.theme]: nextTheme }).catch(() => {})
  }

  // Register the toggle drawer callback to index.tsx so background script onClicked triggers can slide it
  useEffect(() => {
    registerToggle(() => {
      setIsOpen((prev) => !prev)
    })
  }, [registerToggle])

  // Pull the latest notes from other devices when the drawer opens or active tab switches to notes.
  useEffect(() => {
    if (isOpen && alive) {
      void reloadNotes()
      sendToBackground({ type: 'sync:maybe' }).catch(() => {})
    }
  }, [isOpen, alive, reloadNotes])

  useEffect(() => {
    if (activeTab === 'notes' && alive) {
      void reloadNotes()
    }
  }, [activeTab, alive, reloadNotes])

  const closeEditor = useCallback(() => setActiveNoteId(null), [])

  const handleCreateNewClick = () => {
    // Open the editor synchronously inside the click so the PiP window still
    // has the user activation it needs; the note is created in the background.
    const newNote = { id: generateId(), title: 'New Note', body: '' }
    const { id } = newNote
    setNotice(null)
    setDraft(newNote)
    setActiveNoteId(id)
    addNote(newNote).catch((e: unknown) => {
      setActiveNoteId((current) => (current === id ? null : current))
      setNotice(`Couldn't create the note: ${errorMessage(e)}`)
    })
  }

  const handleNoteDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this note?')) return
    setNotice(null)
    try {
      await deleteNote(id)
      if (activeNoteId === id) setActiveNoteId(null)
    } catch (err) {
      setNotice(`Couldn't delete the note: ${errorMessage(err)}`)
    }
  }

  const activeNote = activeNoteId ? notes.find((n) => n.id === activeNoteId) : undefined

  return (
    <div className={`nid-overlay-root nid-theme-${theme}`}>
      {/* 1. Slide-out right sidebar drawer */}
      <div
        className={`nid-drawer-panel ${isOpen ? 'nid-drawer-open' : 'nid-drawer-closed'}`}
        inert={!isOpen}
        aria-hidden={!isOpen}
        role="complementary"
        aria-label="Note It Down"
      >
        <header className="nid-drawer-header">
          <h1 className="nid-drawer-title">📝 Note It Down</h1>
          <div className="nid-drawer-actions">
            <a
              href="https://github.com/Shakya47/note-it-down"
              target="_blank"
              rel="noopener noreferrer"
              className="nid-drawer-github-link"
              title="View on GitHub"
              aria-label="View on GitHub"
            >
              <svg height="22" width="22" viewBox="0 0 16 16" fill="var(--nid-color-dark)" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
            </a>
            <button
              className="nid-drawer-avatar-btn"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
            <button
              className="nid-drawer-close-btn"
              title="Hide drawer"
              aria-label="Hide drawer"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>
        </header>

        {!alive && (
          <div className="nid-drawer-alert" role="alert">
            Note It Down was updated or reloaded. Reload this page to keep editing.
          </div>
        )}
        {alive && notice && (
          <div className="nid-drawer-alert" role="alert">
            {notice}
            <button className="nid-drawer-alert-dismiss" aria-label="Dismiss" onClick={() => setNotice(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Tab Bar Navigation */}
        <div className="nid-tab-bar" role="tablist" aria-label="Drawer sections">
          <button
            id="nid-tab-notes"
            role="tab"
            aria-selected={activeTab === 'notes'}
            aria-controls="nid-panel-notes"
            className={`nid-tab-btn ${activeTab === 'notes' ? 'nid-tab-active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
          <button
            id="nid-tab-sync"
            role="tab"
            aria-selected={activeTab === 'sync'}
            aria-controls="nid-panel-sync"
            className={`nid-tab-btn ${activeTab === 'sync' ? 'nid-tab-active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            ☁️ Sync
          </button>
        </div>

        <main
          id="nid-panel-notes"
          role="tabpanel"
          aria-labelledby="nid-tab-notes"
          className="nid-drawer-main"
          hidden={activeTab !== 'notes'}
        >
          {loading ? (
            <div className="nid-drawer-loading">Loading notes...</div>
          ) : (
            <>
              <button
                className="nid-drawer-new-btn"
                onClick={handleCreateNewClick}
                disabled={!alive}
              >
                ✨ New Note
              </button>

              {/* Editor: opens in a Picture-in-Picture window; where that isn't
                  available it stays here, inline in the drawer. */}
              <PipWrapper
                width={380}
                height={360}
                reserveSpace={false}
                open={activeNoteId !== null}
                onOpenChange={(openState) => {
                  if (!openState) {
                    setActiveNoteId(null)
                  }
                }}
                placeholder={<EmptyPlaceholder />}
                placeholderClassName="nid-pip-placeholder"
                originAs={EditorSlot}
              >
                {activeNoteId && (
                  <NoteEditor
                    key={activeNoteId}
                    noteId={activeNoteId}
                    note={activeNote}
                    initialDraft={draft?.id === activeNoteId ? draft : undefined}
                    notesLoading={loading}
                    alive={alive}
                    onSave={updateNote}
                    onClose={closeEditor}
                    theme={theme}
                  />
                )}
              </PipWrapper>

              <div className="nid-drawer-list-wrapper">
                <NoteList
                  notes={notes}
                  onNoteClick={setActiveNoteId}
                  onNoteDelete={handleNoteDelete}
                  activeNoteId={activeNoteId}
                />
              </div>
            </>
          )}
        </main>
        <main
          id="nid-panel-sync"
          role="tabpanel"
          aria-labelledby="nid-tab-sync"
          className="nid-drawer-main"
          hidden={activeTab !== 'sync'}
        >
          <div className="nid-drawer-list-wrapper">
            <SyncStatusPanel alive={alive} />
          </div>
        </main>
      </div>

    </div>
  )
}
