import { useState, useEffect } from 'react';
import { generateToken } from '../../sync/crypto';
import { sync } from '../../sync/sync';
import styles from './SyncSettings.module.css';

export function SyncSettings() {
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<'success' | 'error' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNoConfigWarning, setShowNoConfigWarning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        [
          'nid-sync-server-url',
          'nid-sync-token',
          'nid-sync-last-synced',
          'nid-sync-last-status',
          'nid-sync-last-error',
        ],
        (result) => {
          setServerUrl((result['nid-sync-server-url'] as string) || '');
          setToken((result['nid-sync-token'] as string) || '');
          setLastSynced((result['nid-sync-last-synced'] as string) || null);
          setLastStatus((result['nid-sync-last-status'] as 'success' | 'error' | null) || null);
          setLastError((result['nid-sync-last-error'] as string) || null);
        }
      );
    } else {
      setServerUrl(localStorage.getItem('nid-sync-server-url') || '');
      setToken(localStorage.getItem('nid-sync-token') || '');
      setLastSynced(localStorage.getItem('nid-sync-last-synced') || null);
      setLastStatus((localStorage.getItem('nid-sync-last-status') as 'success' | 'error' | null) || null);
      setLastError(localStorage.getItem('nid-sync-last-error') || null);
    }
  }, []);

  const handleGenerateToken = () => {
    const newToken = generateToken();
    setToken(newToken);
    setCopied(false);
  };

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API isn't available
      const textArea = document.createElement('textarea');
      textArea.value = token;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAndSync = async () => {
    const trimmedUrl = serverUrl.trim();
    const trimmedToken = token.trim();

    if (!trimmedUrl || !trimmedToken) {
      setShowNoConfigWarning(true);
      return;
    }
    setShowNoConfigWarning(false);
    setIsSyncing(true);

    // Save URL & Token
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            'nid-sync-server-url': trimmedUrl,
            'nid-sync-token': trimmedToken,
          },
          resolve
        );
      });
    } else {
      localStorage.setItem('nid-sync-server-url', trimmedUrl);
      localStorage.setItem('nid-sync-token', trimmedToken);
    }

    // Call sync
    const result = await sync(trimmedUrl, trimmedToken);

    setIsSyncing(false);
    const now = new Date().toISOString();
    const status = result.success ? 'success' : 'error';
    const errorMsg = result.error || null;

    setLastStatus(status);
    setLastError(errorMsg);
    if (result.success) {
      setLastSynced(now);
    }

    // Save results
    const updateObj: any = {
      'nid-sync-last-status': status,
      'nid-sync-last-error': errorMsg,
    };
    if (result.success) {
      updateObj['nid-sync-last-synced'] = now;
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set(updateObj);
    } else {
      localStorage.setItem('nid-sync-last-status', status);
      localStorage.setItem('nid-sync-last-error', errorMsg || '');
      if (result.success) {
        localStorage.setItem('nid-sync-last-synced', now);
      }
    }
  };

  const formatTimestamp = (isoStr: string | null) => {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>☁️ Sync (Optional)</h2>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Worker URL</label>
        <input
          className={styles.input}
          type="text"
          placeholder="https://your-worker.workers.dev"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          disabled={isSyncing}
          data-element-id="server-url-input"
        />
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Sync Token</label>
        <div className={styles.tokenRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="Click Generate to create a token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isSyncing}
            data-element-id="token-input"
          />
          <button
            className={styles.genBtn}
            onClick={handleGenerateToken}
            disabled={isSyncing}
            data-element-id="generate-token-btn"
          >
            Generate
          </button>
          <button
            className={`${styles.genBtn} ${copied ? styles.copiedBtn : ''}`}
            onClick={handleCopyToken}
            disabled={isSyncing || !token}
            data-element-id="copy-token-btn"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {showNoConfigWarning && (
        <div className={styles.inlineWarn} data-element-id="no-config-warning">
          ⚠️ Please configure a Worker URL and Token. See the{' '}
          <a
            href="https://github.com/Shakya47/note-it-down/blob/main/sync-worker/README.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            deploy instructions
          </a>{' '}
          to set up your own worker.
        </div>
      )}

      <button
        className={styles.syncBtn}
        onClick={handleSaveAndSync}
        disabled={isSyncing}
        data-element-id="save-sync-btn"
      >
        {isSyncing ? 'Syncing...' : 'Save & Sync'}
      </button>

      <hr className={styles.divider} />

      {lastStatus && (
        <div className={styles.statusRow}>
          <div className={styles.statusLabel}>Last Sync Status</div>
          {lastStatus === 'success' ? (
            <div className={styles.statusOk} data-element-id="sync-status">
              ✅ Synced successfully
            </div>
          ) : (
            <div className={styles.statusErr} data-element-id="sync-status">
              ❌ Sync Failed
            </div>
          )}
          <div className={styles.syncTimestamp} data-element-id="sync-timestamp">
            Last synced: {formatTimestamp(lastSynced)}
          </div>
        </div>
      )}

      {lastStatus === 'error' && lastError && (
        <div className={`${styles.statusRow} ${styles.errorRow}`} data-element-id="error-row">
          <div className={styles.statusLabel}>Error Detail</div>
          <div className={styles.statusErr} data-element-id="sync-error-msg">
            {lastError}
          </div>
        </div>
      )}
    </div>
  );
}
