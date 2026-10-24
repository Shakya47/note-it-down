import { useSyncExternalStore } from 'react'
import { checkWorker, deleteRemote, syncNotes } from '../../src/sync/engine'
import { isStrongToken, normalizeServerUrl, type SyncConfig } from '../../src/sync/config'
import { SYNC_BASE_KEY } from '../../src/lib/notesRepo'
import { errorMessage } from '../../src/lib/notes'
import type { WorkerCheck } from '../../src/lib/messages'
import { kv, onStorageChange, repo } from './storage'

const CONFIG_KEY = 'nid-sync-config'
const STATUS_KEY = 'nid-sync-status'
const AFTER_EDIT_DELAY_MS = 3_000
const PERIOD_MS = 2 * 60_000
const VISIBLE_THROTTLE_MS = 15_000

export interface SyncState {
  ready: boolean
  config: SyncConfig | null
  syncing: boolean
  lastStatus: 'success' | 'error' | null
  lastError: string | null
  lastSynced: string | null
  pending: boolean
}

type PersistedStatus = Pick<SyncState, 'lastStatus' | 'lastError' | 'lastSynced' | 'pending'>

let state: SyncState = {
  ready: false,
  config: null,
  syncing: false,
  lastStatus: null,
  lastError: null,
  lastSynced: null,
  pending: false,
}
const subscribers = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const fn of subscribers) fn()
}

async function saveStatus(patch: Partial<PersistedStatus>) {
  setState(patch)
  const { lastStatus, lastError, lastSynced, pending } = state
  await kv.set(STATUS_KEY, { lastStatus, lastError, lastSynced, pending })
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    () => state
  )
}

/** Default worker URL: the app is normally served by the sync worker itself. */
export function defaultServerUrl(): string {
  const { protocol, hostname, origin } = location
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1' ? origin : ''
}

async function loadPersisted() {
  const [config, status] = await Promise.all([kv.get(CONFIG_KEY), kv.get(STATUS_KEY)])
  setState({
    ready: true,
    config: (config as SyncConfig | undefined) ?? null,
    ...((status as PersistedStatus | undefined) ?? {}),
  })
}

let inFlight: Promise<void> | null = null
let rerun = false
let lastAttemptAt = 0
let debounce: ReturnType<typeof setTimeout> | undefined

/** Runs a sync now (or once more after the current one). Safe to call often. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    rerun = true
    return inFlight
  }
  inFlight = (async () => {
    do {
      rerun = false
      await syncOnce()
    } while (rerun && state.lastStatus === 'success')
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function syncOnce() {
  const config = state.config
  if (!config || !navigator.onLine) return
  lastAttemptAt = Date.now()
  const mutationsBefore = repo.getMutationCount()

  // One tab syncs at a time; others skip (the server's compare-and-swap
  // would keep them safe anyway, this just avoids wasted requests).
  const runLocked = async () => {
    setState({ syncing: true })
    try {
      const result = await syncNotes(config, repo)
      await saveStatus({
        lastStatus: result.success ? 'success' : 'error',
        lastError: result.error ?? null,
        ...(result.success ? { lastSynced: result.syncedAt ?? null } : {}),
        ...(result.success && repo.getMutationCount() === mutationsBefore ? { pending: false } : {}),
      })
    } finally {
      setState({ syncing: false })
    }
  }
  if (navigator.locks) {
    await navigator.locks.request('nid-sync', { ifAvailable: true }, (held) => (held ? runLocked() : undefined))
  } else {
    await runLocked()
  }
}

function syncSoon() {
  clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), AFTER_EDIT_DELAY_MS)
}

export async function initSync() {
  await loadPersisted()

  repo.onLocalMutation(() => {
    if (!state.pending) void saveStatus({ pending: true })
    syncSoon()
  })

  // Another tab changed settings or status.
  onStorageChange((key) => {
    if (key === CONFIG_KEY || key === STATUS_KEY) void loadPersisted()
  })

  const syncIfStale = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastAttemptAt > VISIBLE_THROTTLE_MS) {
      void syncNow()
    }
  }
  document.addEventListener('visibilitychange', syncIfStale)
  window.addEventListener('online', () => void syncNow())
  setInterval(syncIfStale, PERIOD_MS)

  void syncNow()
}

export async function configure(serverUrl: string, token: string): Promise<WorkerCheck> {
  const url = normalizeServerUrl(serverUrl)
  const trimmed = token.trim()
  if (!isStrongToken(trimmed)) {
    throw new Error('Paste the sync token from the extension (Sync settings → Copy).')
  }
  const worker = await checkWorker(url)

  while (inFlight) await inFlight
  const previous = state.config
  if (!previous || previous.serverUrl !== url || previous.token !== trimmed) {
    // Last-synced versions belong to the old server/token.
    await kv.remove(SYNC_BASE_KEY)
  }
  const config = { serverUrl: url, token: trimmed }
  await kv.set(CONFIG_KEY, config)
  setState({ config })
  await syncNow()
  return worker
}

export async function disconnect() {
  while (inFlight) await inFlight
  await Promise.all([kv.remove(CONFIG_KEY), kv.remove(SYNC_BASE_KEY)])
  setState({ config: null })
  await saveStatus({ lastStatus: null, lastError: null, lastSynced: null })
}

export async function deleteServerData() {
  if (!state.config) throw new Error('Sync is not set up')
  while (inFlight) await inFlight
  await deleteRemote(state.config)
  await disconnect()
}

export { errorMessage }
