import type { Note } from '../types'

/** Messages handled by the background service worker. */
export type BackgroundMessage =
  | { type: 'notes:add'; id: string; title: string; body: string }
  | { type: 'notes:update'; id: string; title: string; body: string; baseVersion?: number }
  | { type: 'notes:delete'; id: string }
  | { type: 'sync:now' }
  | { type: 'sync:maybe' }
  | { type: 'sync:configure'; serverUrl: string; token: string }
  | { type: 'sync:disconnect' }
  | { type: 'sync:deleteRemote' }
  | { type: 'options:open' }

export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SyncResult {
  success: boolean
  syncedAt?: string // ISO timestamp, present on success
  error?: string // human-readable error, present on failure
}

export type WorkerCheck = 'ok' | 'legacy'

export interface ConfigureResult {
  worker: WorkerCheck
  sync: SyncResult
}

export interface BackgroundResponses {
  'notes:add': Note
  'notes:update': Note
  'notes:delete': null
  'sync:now': SyncResult
  'sync:maybe': null
  'sync:configure': ConfigureResult
  'sync:disconnect': null
  'sync:deleteRemote': null
  'options:open': null
}

/** Message the background sends to the content script. */
export const TOGGLE_DRAWER = 'TOGGLE_DRAWER'

/** chrome.storage.local keys. */
export const STORAGE_KEYS = {
  notes: 'notes',
  syncBase: 'nid-sync-base',
  serverUrl: 'nid-sync-server-url',
  token: 'nid-sync-token',
  lastSynced: 'nid-sync-last-synced',
  lastStatus: 'nid-sync-last-status',
  lastError: 'nid-sync-last-error',
  pending: 'nid-sync-pending',
  theme: 'nid-theme',
} as const
