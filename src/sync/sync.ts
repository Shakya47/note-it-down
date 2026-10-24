import { syncNotes } from './engine';
import type { SyncConfig } from './config';
import type { SyncResult } from '../lib/messages';
import { notesRepo } from '../background/notesStore';

export { checkWorker, deleteRemote } from './engine';

/** Extension sync: runs in the background service worker, which owns note storage. */
export function sync(config: SyncConfig): Promise<SyncResult> {
  return syncNotes(config, notesRepo);
}
