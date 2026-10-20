import type { Note } from '../types'
import {
  STORAGE_KEYS,
  type BackgroundMessage,
  type BackgroundResponses,
  type MessageResponse,
} from './messages'
import { errorMessage, isNoteArray, sanitizeNotes } from './notes'

/**
 * Thrown when this script belongs to an extension instance that has since been
 * updated or reloaded: every chrome.* call fails and nothing can be saved.
 */
export class ExtensionContextInvalidatedError extends Error {
  constructor() {
    super('Note It Down was updated or reloaded. Reload this page to keep editing.')
    this.name = 'ExtensionContextInvalidatedError'
  }
}

export function isExtensionAlive(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id
  } catch {
    return false
  }
}

export async function sendToBackground<T extends BackgroundMessage>(
  message: T
): Promise<BackgroundResponses[T['type']]> {
  if (!isExtensionAlive()) throw new ExtensionContextInvalidatedError()

  let response: MessageResponse<BackgroundResponses[T['type']]> | undefined
  try {
    response = await chrome.runtime.sendMessage(message)
  } catch (e) {
    if (!isExtensionAlive() || /context invalidated/i.test(errorMessage(e))) {
      throw new ExtensionContextInvalidatedError()
    }
    throw e
  }
  if (!response) throw new Error('No response from the extension background')
  if (!response.ok) throw new Error(response.error)
  return response.data
}

export async function readNotes(): Promise<Note[]> {
  if (!isExtensionAlive()) throw new ExtensionContextInvalidatedError()
  const result = await chrome.storage.local.get(STORAGE_KEYS.notes)
  const notes = result[STORAGE_KEYS.notes]
  return isNoteArray(notes) ? sanitizeNotes(notes) : []
}

export function addNote(input: { id: string; title: string; body: string }) {
  return sendToBackground({ type: 'notes:add', ...input })
}

export function updateNote(id: string, updates: { title: string; body: string }, baseVersion?: number) {
  return sendToBackground({ type: 'notes:update', id, ...updates, baseVersion })
}

export async function deleteNote(id: string): Promise<void> {
  await sendToBackground({ type: 'notes:delete', id })
}
