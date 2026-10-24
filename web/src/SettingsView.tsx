import { useEffect, useState } from 'react'
import { deriveKeys } from '../../src/sync/crypto'
import { isStrongToken, normalizeServerUrl } from '../../src/sync/config'
import { configure, defaultServerUrl, deleteServerData, disconnect, errorMessage, syncNow, useSyncState } from './sync'
import { formatTimestamp } from './time'
import styles from '../../src/ui/settings/SyncSettings.module.css'

type Message = { kind: 'ok' | 'warn' | 'error'; text: string } | null

const formatSyncId = (address: string) => `${address.slice(0, 4)}-${address.slice(4, 8)}`.toUpperCase()

export function SettingsView({ onBack }: { onBack: () => void }) {
  const sync = useSyncState()
  const [serverUrl, setServerUrl] = useState(() => sync.config?.serverUrl ?? defaultServerUrl())
  const [token, setToken] = useState(() => sync.config?.token ?? '')
  const [showToken, setShowToken] = useState(false)
  const [derived, setDerived] = useState<{ token: string; address: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  const trimmedToken = token.trim()
  useEffect(() => {
    if (!isStrongToken(trimmedToken)) return
    let cancelled = false
    deriveKeys(trimmedToken).then((keys) => {
      if (!cancelled) setDerived({ token: trimmedToken, address: keys.address })
    })
    return () => {
      cancelled = true
    }
  }, [trimmedToken])
  const address = derived?.token === trimmedToken ? derived.address : null

  const run = async (action: () => Promise<Message>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const handleSave = () =>
    run(async () => {
      normalizeServerUrl(serverUrl)
      const worker = await configure(serverUrl, trimmedToken)
      if (worker === 'legacy') {
        return { kind: 'warn', text: 'Connected. Your worker is an older version; redeploy it from the sync-worker guide.' }
      }
      return { kind: 'ok', text: 'Connected. This phone now syncs automatically.' }
    })

  const handleDisconnect = () => {
    if (!confirm('Stop syncing on this device? Notes stay on this device and on the server.')) return
    void run(async () => {
      await disconnect()
      setToken('')
      return { kind: 'ok', text: 'This device is no longer syncing.' }
    })
  }

  const handleDeleteServer = () => {
    if (
      !confirm(
        'Permanently delete your encrypted notes from the worker and disconnect this device?\n\nNotes on your devices are not deleted. Any other device still using this token will upload its notes again.'
      )
    ) {
      return
    }
    void run(async () => {
      await deleteServerData()
      setToken('')
      return { kind: 'ok', text: 'Server data deleted and this device disconnected.' }
    })
  }

  return (
    <div className="nid-web-page">
      <header className="nid-drawer-header nid-web-header">
        <button className="nid-web-back" onClick={onBack} aria-label="Back to notes">
          ←
        </button>
        <h1 className="nid-drawer-title">Sync settings</h1>
        <span className="nid-web-header-spacer" />
      </header>

      <main className="nid-web-main">
        <div className={styles.container}>
          <p className={styles.helpText}>
            Use the same worker and token as the extension. Notes are encrypted on this device before upload, and the
            app also works offline.
          </p>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="web-server-url">Worker URL</label>
            <input
              id="web-server-url"
              className={styles.input}
              type="url"
              inputMode="url"
              placeholder="https://your-worker.workers.dev"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="web-sync-token">Sync token</label>
            <div className={styles.tokenRow}>
              <input
                id="web-sync-token"
                className={styles.input}
                type={showToken ? 'text' : 'password'}
                placeholder="Paste the token from the extension"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                className={styles.genBtn}
                onClick={() => setShowToken((v) => !v)}
                disabled={busy || !token}
                aria-pressed={showToken}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            {address ? (
              <div className={styles.syncTimestamp}>
                Sync ID: <strong className={styles.syncId}>{formatSyncId(address)}</strong> — must match the extension.
              </div>
            ) : (
              trimmedToken && <div className={styles.syncTimestamp}>Not a valid sync token.</div>
            )}
          </div>

          <button className={styles.syncBtn} onClick={handleSave} disabled={busy || !trimmedToken}>
            {busy ? 'Working...' : 'Save & Sync'}
          </button>

          {message && (
            <div
              className={message.kind === 'error' ? styles.inlineWarn : message.kind === 'warn' ? styles.inlineNote : styles.inlineOk}
              role={message.kind === 'ok' ? 'status' : 'alert'}
            >
              {message.text}
            </div>
          )}

          {sync.config && (
            <>
              <hr className={styles.divider} />
              <div className={styles.statusRow}>
                <div className={styles.statusLabel}>Status</div>
                {sync.syncing ? (
                  <div className={styles.syncTimestamp}>Syncing…</div>
                ) : sync.lastStatus === 'error' ? (
                  <div className={styles.statusErr}>❌ Last sync failed</div>
                ) : sync.lastStatus === 'success' ? (
                  <div className={styles.statusOk}>✅ Synced</div>
                ) : (
                  <div className={styles.syncTimestamp}>Not synced yet</div>
                )}
                {sync.pending && <div className={styles.pendingText}>• Unsynced changes on this device</div>}
                <div className={styles.syncTimestamp}>Last synced: {formatTimestamp(sync.lastSynced)}</div>
                {sync.lastStatus === 'error' && sync.lastError && (
                  <div className={styles.statusErr}>{sync.lastError}</div>
                )}
              </div>
              <button className={styles.genBtn} onClick={() => void syncNow()} disabled={busy || sync.syncing}>
                Sync now
              </button>
              <div className={styles.dangerZone}>
                <button className={styles.genBtn} onClick={handleDisconnect} disabled={busy}>
                  Disconnect this device
                </button>
                <button className={styles.dangerBtn} onClick={handleDeleteServer} disabled={busy}>
                  Delete server data
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
