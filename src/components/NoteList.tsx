import type { Note } from '../types'
import { NoteItem } from './NoteItem'
import styles from './NoteList.module.css'

interface NoteListProps {
  notes: Note[]
  onNoteClick: (id: string) => void
  onNoteDelete: (e: React.MouseEvent, id: string) => void
  activeNoteId?: string | null
}

export function NoteList({ notes, onNoteClick, onNoteDelete, activeNoteId = null }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className={styles.emptyStateCard}>
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji} role="img" aria-label="pen">
            🖋️
          </span>
          <p className={styles.emptyText}>No notes yet. Click above to create one!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.noteList}>
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          onClick={() => onNoteClick(note.id)}
          onDelete={(e) => onNoteDelete(e, note.id)}
          isActive={note.id === activeNoteId}
        />
      ))}
    </div>
  )
}
