import { useCallback, useEffect, useMemo, useState } from 'react'
import { NoteEditor } from '../../src/components/NoteEditor'
import { NoteList } from '../../src/components/NoteList'
import { errorMessage, generateId } from '../../src/lib/notes'
import { useWebNotes } from './useWebNotes'
import { syncNow, useSyncState } from './sync'
import { SettingsView } from './SettingsView'
import { timeAgo } from './time'

type View = { name: 'list' } | { name: 'note'; id: string } | { name: 'settings' }
type Theme = 'light' | 'dark'

const THEME_KEY = 'nid-theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage unavailable (private mode); fall through to the system setting.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function App() {
  const { notes, loading, loadError, addNote, updateNote, deleteNote } = useWebNotes()
  const sync = useSyncState()
  const [view, setView] = useState<View>(() => (history.state as View | null) ?? { name: 'list' })
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<{ id: string; title: string; body: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Views are history entries, so the phone's back gesture/button works.
  useEffect(() => {
    if (!history.state) history.replaceState({ name: 'list' }, '')
    const onPop = (event: PopStateEvent) => setView((event.state as View | null) ?? { name: 'list' })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((next: View) => {
    history.pushState(next, '')
    setView(next)
  }, [])

  const goBack = useCallback(() => {
    if (history.state && (history.state as View).name !== 'list') history.back()
    else setView({ name: 'list' })
  }, [])

  useEffect(() => {
    document.body.className = `nid-theme-${theme}`
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Not persisted; the choice still applies for this session.
    }
  }, [theme])

  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
  }, [notes, query])

  const createNote = () => {
    const newNote = { id: generateId(), title: 'New Note', body: '' }
    setNotice(null)
    setDraft(newNote)
    navigate({ name: 'note', id: newNote.id })
    addNote(newNote).catch((e: unknown) => {
      setNotice(`Couldn't create the note: ${errorMessage(e)}`)
      goBack()
    })
  }

  const removeNote = async (id: string) => {
    if (!confirm('Delete this note?')) return false
    try {
      await deleteNote(id)
      return true
    } catch (e) {
      setNotice(`Couldn't delete the note: ${errorMessage(e)}`)
      return false
    }
  }

  const themeClass = `nid-overlay-root nid-theme-${theme} nid-web`

  if (view.name === 'settings') {
    return (
      <div className={themeClass}>
        <SettingsView onBack={goBack} />
      </div>
    )
  }

  if (view.name === 'note') {
    return (
      <div className={`${themeClass} nid-web-editor`}>
        <NoteEditor
          key={view.id}
          noteId={view.id}
          note={notes.find((n) => n.id === view.id)}
          initialDraft={draft?.id === view.id ? draft : undefined}
          notesLoading={loading}
          alive
          onSave={updateNote}
          onClose={goBack}
          // The editor closes itself once the note disappears from storage.
          onDelete={() => void removeNote(view.id)}
          theme={theme}
          layout="page"
        />
      </div>
    )
  }

  return (
    <div className={themeClass}>
      <div className="nid-web-page">
        <header className="nid-drawer-header nid-web-header">
          <h1 className="nid-drawer-title">📝 Note It Down</h1>
          <div className="nid-drawer-actions">
            <SyncPill onOpenSettings={() => navigate({ name: 'settings' })} sync={sync} />
            <button
              className="nid-drawer-avatar-btn"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
            <button
              className="nid-drawer-avatar-btn"
              aria-label="Sync settings"
              onClick={() => navigate({ name: 'settings' })}
            >
              ⚙️
            </button>
          </div>
        </header>

        {(notice || loadError) && (
          <div className="nid-drawer-alert" role="alert">
            {notice ?? `Couldn't load notes: ${loadError}`}
            <button className="nid-drawer-alert-dismiss" aria-label="Dismiss" onClick={() => setNotice(null)}>
              ✕
            </button>
          </div>
        )}

        <main className="nid-web-main">
          {sync.ready && !sync.config && (
            <button className="nid-web-setup" onClick={() => navigate({ name: 'settings' })}>
              <strong>Sync isn't set up.</strong> Notes stay on this device. Tap to connect your worker →
            </button>
          )}

          <input
            className="nid-web-search"
            type="search"
            placeholder="Search notes"
            aria-label="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button className="nid-drawer-new-btn" onClick={createNote}>
            ✨ New Note
          </button>

          {loading ? (
            <div className="nid-drawer-loading">Loading notes...</div>
          ) : query && visibleNotes.length === 0 ? (
            <p className="nid-web-empty">No notes match “{query}”.</p>
          ) : (
            <NoteList
              notes={visibleNotes}
              onNoteClick={(id) => navigate({ name: 'note', id })}
              onNoteDelete={(e, id) => {
                e.stopPropagation()
                void removeNote(id)
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function SyncPill({ sync, onOpenSettings }: { sync: ReturnType<typeof useSyncState>; onOpenSettings: () => void }) {
  // Re-render every 30s so "2m ago" stays current.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  if (!sync.ready || !sync.config) return null

  let label: string
  let tone: 'ok' | 'busy' | 'warn' | 'error'
  if (sync.syncing) [label, tone] = ['Syncing…', 'busy']
  else if (!navigator.onLine) [label, tone] = ['Offline', 'warn']
  else if (sync.lastStatus === 'error') [label, tone] = ['Sync failed', 'error']
  else if (sync.pending) [label, tone] = ['Unsynced', 'warn']
  else [label, tone] = [sync.lastSynced ? `Synced ${timeAgo(sync.lastSynced)}` : 'Not synced', 'ok']

  return (
    <button
      className={`nid-web-pill nid-web-pill-${tone}`}
      onClick={() => (tone === 'error' ? onOpenSettings() : void syncNow())}
      title={sync.lastError ?? 'Sync now'}
    >
      {label}
    </button>
  )
}
