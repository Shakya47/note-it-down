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
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'Recent'
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getBodyPreview = (bodyText: string) => {
    if (!bodyText) return 'Empty note content'
    const firstLine = bodyText.split('\n')[0]
    return firstLine || 'Empty note content'
  }

  const title = note.title || 'Untitled note'

  return (
    <li className={`${styles.noteItem} ${isActive ? styles.active : ''}`}>
      <button
        type="button"
        className={styles.openBtn}
        onClick={onClick}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className={styles.noteTitle}>{title}</span>
        <span className={styles.notePreview}>{getBodyPreview(note.body)}</span>
        <span className={styles.noteDate}>{formatDate(note.updatedAt)}</span>
      </button>
      <button
        type="button"
        className={styles.deleteBtn}
        title="Delete note"
        aria-label={`Delete note: ${title}`}
        onClick={onDelete}
      >
        🗑️
      </button>
    </li>
  )
}
