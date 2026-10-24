import { useState } from 'react'
import { sendToBackground } from '../../lib/notesClient'
import { errorMessage } from '../../lib/notes'
import { formatTimestamp, useSyncStatus } from './useSyncStatus'
import styles from './SyncSettings.module.css'

/**
 * Sync status shown inside the in-page drawer. Configuration (and the token)
 * lives only on the extension's options page, out of reach of websites.
 */
export function SyncStatusPanel({ alive }: { alive: boolean }) {
  const status = useSyncStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const openSettings = () => {
    setActionError(null)
    sendToBackground({ type: 'options:open' }).catch((e: unknown) => setActionError(errorMessage(e)))
  }

  const syncNow = async () => {
    setActionError(null)
    setIsSyncing(true)
    try {
      await sendToBackground({ type: 'sync:now' })
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>☁️ Sync (Optional)</h2>

      {!status.configured ? (
        <p className={styles.helpText}>
          Sync keeps your notes in step across devices using your own end-to-end encrypted worker.
        </p>
      ) : (
        <div className={styles.statusRow}>
          <div className={styles.statusLabel}>Status</div>
          {status.lastStatus === 'error' ? (
            <div className={styles.statusErr} data-element-id="sync-status">❌ Last sync failed</div>
          ) : status.lastStatus === 'success' ? (
            <div className={styles.statusOk} data-element-id="sync-status">✅ Synced</div>
          ) : (
            <div className={styles.syncTimestamp}>Not synced yet</div>
          )}
          {status.pending && <div className={styles.pendingText}>• Unsynced changes on this device</div>}
          <div className={styles.syncTimestamp} data-element-id="sync-timestamp">
            Last synced: {formatTimestamp(status.lastSynced)}
          </div>
          {status.lastStatus === 'error' && status.lastError && (
            <div className={styles.statusErr} data-element-id="sync-error-msg">{status.lastError}</div>
          )}
        </div>
      )}

      {status.configured && (
        <button className={styles.syncBtn} onClick={syncNow} disabled={isSyncing || !alive}>
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </button>
      )}

      <button className={styles.genBtn} onClick={openSettings} disabled={!alive}>
        {status.configured ? 'Sync settings' : 'Set up sync'}
      </button>

      {actionError && (
        <div className={styles.inlineWarn} role="alert">{actionError}</div>
      )}
    </div>
  )
}
