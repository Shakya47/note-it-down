import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../lib/messages'

export interface SyncStatus {
  configured: boolean
  serverUrl: string | null
  lastSynced: string | null
  lastStatus: 'success' | 'error' | null
  lastError: string | null
  pending: boolean
}

const STATUS_KEYS = [
  STORAGE_KEYS.serverUrl,
  STORAGE_KEYS.lastSynced,
  STORAGE_KEYS.lastStatus,
  STORAGE_KEYS.lastError,
  STORAGE_KEYS.pending,
]

const EMPTY: SyncStatus = {
  configured: false,
  serverUrl: null,
  lastSynced: null,
  lastStatus: null,
  lastError: null,
  pending: false,
}

function toStatus(values: Record<string, unknown>): SyncStatus {
  const str = (key: string) => (typeof values[key] === 'string' && values[key] ? (values[key] as string) : null)
  const status = values[STORAGE_KEYS.lastStatus]
  const serverUrl = str(STORAGE_KEYS.serverUrl)
  return {
    configured: serverUrl !== null,
    serverUrl,
    lastSynced: str(STORAGE_KEYS.lastSynced),
    lastStatus: status === 'success' || status === 'error' ? status : null,
    lastError: str(STORAGE_KEYS.lastError),
    pending: values[STORAGE_KEYS.pending] === true,
  }
}

/**
 * Live sync status written by the background service worker. Deliberately
 * never reads the sync token, so it is safe to use inside web pages.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(EMPTY)

  useEffect(() => {
    let mounted = true
    let values: Record<string, unknown> = {}

    chrome.storage.local
      .get(STATUS_KEYS)
      .then((result) => {
        if (!mounted) return
        values = result
        setStatus(toStatus(values))
      })
      .catch(() => {})

    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local' || !STATUS_KEYS.some((key) => key in changes)) return
      values = { ...values }
      for (const key of STATUS_KEYS) {
        if (key in changes) values[key] = changes[key].newValue
      }
      setStatus(toStatus(values))
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      mounted = false
      try {
        chrome.storage.onChanged.removeListener(onChanged)
      } catch {
        // Extension context already gone.
      }
    }
  }, [])

  return status
}

export function formatTimestamp(isoStr: string | null): string {
  if (!isoStr) return '—'
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return isoStr
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
