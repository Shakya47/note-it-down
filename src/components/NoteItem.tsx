import type { Note } from '../types'
import styles from './NoteItem.module.css'

interface NoteItemProps {
  note: Note
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isActive?: boolean
}

export function NoteItem({ note, onClick, onDelete, isActive = false }: NoteItemProps) {
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Recent'
    }
  }

  const getBodyPreview = (bodyText: string) => {
    if (!bodyText) return 'Empty note content'
    const firstLine = bodyText.split('\n')[0]
    return firstLine || 'Empty note content'
  }

  return (
    <div className={`${styles.noteItem} ${isActive ? styles.active : ''}`} onClick={onClick}>
      <div className={styles.noteItemHeader}>
        <span className={styles.noteTitle}>
          {note.title || 'Untitled note'}
        </span>
        <button
          className={styles.deleteBtn}
          title="Delete note"
          onClick={onDelete}
        >
          🗑️
        </button>
      </div>
      <div className={styles.notePreview}>{getBodyPreview(note.body)}</div>
      <div className={styles.noteDate}>{formatDate(note.updatedAt)}</div>
    </div>
  )
}
