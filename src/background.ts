import { addNote, deleteNote, updateNote } from './background/notesStore'
import {
    configure,
    deleteRemoteData,
    disconnect,
    ensureAlarm,
    handleAlarm,
    initSyncRunner,
    requestOpportunisticSync,
    runSync,
} from './background/syncRunner'
import { TOGGLE_DRAWER, type MessageResponse } from './lib/messages'
import { errorMessage } from './lib/notes'

function isRestrictedUrl(url?: string): boolean {
    if (!url) return true;
    return (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('chrome-untrusted://') ||
        url.startsWith('chrome-search://') ||
        url.startsWith('devtools://') ||
        url.startsWith('view-source:') ||
        url.startsWith('edge://') ||
        url.startsWith('about:') ||
        url.includes('chromewebstore.google.com') ||
        url.includes('chrome.google.com/webstore')
    );
}

/** Briefly flags the toolbar icon so a click that can't open the drawer isn't silent. */
function flashBadge(tabId: number, title: string) {
    void chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF476F' });
    void chrome.action.setBadgeText({ tabId, text: '!' });
    void chrome.action.setTitle({ tabId, title });
    setTimeout(() => {
        void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
        void chrome.action.setTitle({ tabId, title: 'Open Note It Down' }).catch(() => {});
    }, 4000);
}

const injecting = new Set<number>();

// Listen for toolbar extension icon clicks to toggle slide-out drawer on the tab
chrome.action.onClicked.addListener(async (tab) => {
    const tabId = tab.id;
    if (tabId === undefined) return;

    if (isRestrictedUrl(tab.url)) {
        flashBadge(tabId, "Note It Down can't run on this page");
        return;
    }

    try {
        await chrome.tabs.sendMessage(tabId, { type: TOGGLE_DRAWER });
        return;
    } catch {
        // No live content script in this tab (first open, or the extension was updated).
    }

    // A second click while the first injection is still running would inject twice.
    if (injecting.has(tabId)) return;
    injecting.add(tabId);
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: TOGGLE_DRAWER });
    } catch {
        flashBadge(tabId, "Note It Down couldn't open on this page");
    } finally {
        injecting.delete(tabId);
    }
});

const isString = (value: unknown): value is string => typeof value === 'string';

async function handleMessage(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
    // Sync configuration is only accepted from extension pages (the options page),
    // never from content scripts running inside websites.
    const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL('')) ?? false;
    const requireExtensionPage = () => {
        if (!fromExtensionPage) throw new Error('Not allowed from this context');
    };

    switch (message.type) {
        case 'notes:add':
            if (!isString(message.id) || !isString(message.title) || !isString(message.body)) break;
            return addNote({ id: message.id, title: message.title, body: message.body });
        case 'notes:update': {
            const { id, title, body, baseVersion } = message;
            if (!isString(id) || !isString(title) || !isString(body)) break;
            if (baseVersion !== undefined && typeof baseVersion !== 'number') break;
            return updateNote(id, { title, body }, baseVersion);
        }
        case 'notes:delete':
            if (!isString(message.id)) break;
            await deleteNote(message.id);
            return null;
        case 'sync:now':
            return runSync();
        case 'sync:maybe':
            requestOpportunisticSync();
            return null;
        case 'options:open':
            await chrome.runtime.openOptionsPage();
            return null;
        case 'sync:configure':
            requireExtensionPage();
            if (!isString(message.serverUrl) || !isString(message.token)) break;
            return configure(message.serverUrl, message.token);
        case 'sync:disconnect':
            requireExtensionPage();
            await disconnect();
            return null;
        case 'sync:deleteRemote':
            requireExtensionPage();
            await deleteRemoteData();
            return null;
    }
    throw new Error('Invalid message');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    handleMessage(message as Record<string, unknown>, sender).then(
        (data) => sendResponse({ ok: true, data } satisfies MessageResponse<unknown>),
        (e: unknown) => sendResponse({ ok: false, error: errorMessage(e) } satisfies MessageResponse<unknown>)
    );
    return true; // keep the channel open for the async response
});

chrome.alarms.onAlarm.addListener(handleAlarm);

chrome.runtime.onStartup.addListener(() => {
    void ensureAlarm();
    void runSync();
});

chrome.runtime.onInstalled.addListener(() => {
    void ensureAlarm();
    void runSync();
});

initSyncRunner();
void ensureAlarm();
