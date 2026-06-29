import { useState, useEffect } from 'react'
import { PipWrapper } from '@pip-it-up/react'
import { NoteEditor } from '../components/NoteEditor'
import { NoteList } from '../components/NoteList'
import { useNotes } from '../hooks/useNotes'
import { SyncSettings } from '../ui/settings/SyncSettings'

interface EditorOverlayProps {
  registerToggle: (toggleFn: () => void) => void
}

function EmptyPlaceholder() {
  return <div style={{ display: 'none' }} />
}

export function EditorOverlay({ registerToggle }: EditorOverlayProps) {
  const {
    notes,
    loading,
    addNote,
    deleteNote,
  } = useNotes()

  const [isOpen, setIsOpen] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [activeTab, setActiveTab] = useState<'notes' | 'settings'>('notes')

  // Load saved theme on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['nid-theme'], (result) => {
        if (result['nid-theme'] === 'dark' || result['nid-theme'] === 'light') {
          setTheme(result['nid-theme'])
        }
      })
    } else {
      const savedTheme = localStorage.getItem('nid-theme') as 'light' | 'dark' | null
      if (savedTheme) setTheme(savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ 'nid-theme': nextTheme })
    } else {
      localStorage.setItem('nid-theme', nextTheme)
    }
  }

  // Register the toggle drawer callback to index.tsx so background script onClicked triggers can slide it
  useEffect(() => {
    registerToggle(() => {
      setIsOpen((prev) => !prev)
    })
  }, [registerToggle])

  const openEditorDirectly = (noteId: string) => {
    setActiveNoteId(noteId)
  }

  const handleCreateNewClick = async () => {
    try {
      await addNote({ title: 'New Note', body: '' })
    } catch (e) {}
  }

  const handleNoteClick = (id: string) => {
    openEditorDirectly(id)
  }

  const handleNoteDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(id)
        if (activeNoteId === id) {
          setActiveNoteId(null)
        }
      } catch (e) {}
    }
  }



  return (
    <div className={`nid-overlay-root nid-theme-${theme}`}>
      {/* 1. Slide-out right sidebar drawer */}
      <div className={`nid-drawer-panel ${isOpen ? 'nid-drawer-open' : 'nid-drawer-closed'}`}>
        <header className="nid-drawer-header">
          <h1 className="nid-drawer-title">📝 Note It Down</h1>
          <div className="nid-drawer-actions">
            <a
              href="https://github.com/Shakya47/note-it-down"
              target="_blank"
              rel="noopener noreferrer"
              className="nid-drawer-github-link"
              title="View on GitHub"
            >
              <svg height="22" width="22" viewBox="0 0 16 16" fill="var(--nid-color-dark)">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
            </a>
            <button
              className="nid-drawer-avatar-btn"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
            <button
              className="nid-drawer-close-btn"
              title="Hide drawer"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>
        </header>

        {/* Tab Bar Navigation */}
        <div className="nid-tab-bar">
          <button
            className={`nid-tab-btn ${activeTab === 'notes' ? 'nid-tab-active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
          <button
            className={`nid-tab-btn ${activeTab === 'settings' ? 'nid-tab-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </div>

        <main className="nid-drawer-main" style={{ display: activeTab === 'notes' ? undefined : 'none' }}>
          {loading ? (
            <div className="nid-drawer-loading">Loading notes...</div>
          ) : (
            <>
              <button
                className="nid-drawer-new-btn"
                onClick={handleCreateNewClick}
              >
                ✨ New Note
              </button>

              <div className="nid-drawer-list-wrapper">
                <NoteList
                  notes={notes}
                  onNoteClick={handleNoteClick}
                  onNoteDelete={handleNoteDelete}
                  activeNoteId={activeNoteId}
                />
              </div>
            </>
          )}
        </main>
        <main className="nid-drawer-main" style={{ display: activeTab === 'settings' ? undefined : 'none' }}>
          <div className="nid-drawer-list-wrapper">
            <SyncSettings />
          </div>
        </main>
      </div>

      {/* 2. PipWrapper controlled component hosting the editor overlay inside PiP */}
      <PipWrapper
        width={380}
        height={360}
        open={activeNoteId !== null}
        onOpenChange={(openState) => {
          if (!openState) {
            setActiveNoteId(null)
          }
        }}
        placeholder={<EmptyPlaceholder />}
      >
        {activeNoteId && (
          <NoteEditor
            key={activeNoteId}
            noteId={activeNoteId}
            onClose={() => setActiveNoteId(null)}
            theme={theme}
          />
        )}
      </PipWrapper>
    </div>
  )
}
