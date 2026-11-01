# Privacy Policy — Note It Down

*Last updated: November 2026*

**In short:** Note It Down has no servers run by its developer, no accounts, no analytics and no ads. Your notes stay on your device. If you choose to turn on sync, your notes are encrypted on your device and sent only to a server **you** deploy on **your own** Cloudflare account. The developer can't see your notes, your token or your server.

This policy covers the **Note It Down Chrome extension** and the optional **phone web app** that ships with it.

## What the extension stores on your device

All of this stays in the extension's own storage in your browser (`chrome.storage.local`):

| Data | Why |
| :--- | :--- |
| Your notes: titles, text, created/updated times, a version counter | So you can read and edit them. |
| Deleted notes, kept as small empty markers (no title, no text) | So a deletion can sync to your other devices instead of the note coming back. |
| Your theme choice (light or dark) | So the drawer looks the way you left it. |
| *If you set up sync:* your Worker URL, your sync token, the status of the last sync, and the version of each note at the last sync | To run sync and show its status. |

Notes and the sync token are stored on your device as-is (the extension does not additionally encrypt local storage). Anyone with access to your browser profile or computer could read them, as with any browser data.

## What the extension reads from web pages

Nothing. When you click the toolbar icon, the extension shows its drawer on the current page. It checks the page's address only to tell whether Chrome lets extensions run there (for example `chrome://` pages and the Chrome Web Store do not). That address is not stored or sent anywhere. The extension does not read, collect or change the content of the pages you visit. The drawer is displayed in an isolated container so the page's own scripts can't read your notes.

## Optional sync: what leaves your device, and where it goes

Sync is **off** until you enter a Worker URL and token in the extension's sync settings. When it is on, the extension sends requests **only** to the Worker URL you entered. That server is a small program you deploy to your own Cloudflare account. The developer of this extension does not operate it and has no access to it.

Each sync request contains:

- **A sync ID** (the address of your data on your server), derived from your token. Your token itself is never sent.
- **Your notes, encrypted.** Notes are encrypted on your device with AES-GCM (256-bit) using a key derived from your token. The server stores only the encrypted data and cannot read it.
- **A write-authorization value and, on the first upload, a verification key.** Both are derived from your token and let the server accept changes only from someone who holds the token. The token cannot be recovered from them.

Because the server is yours, whoever runs your Cloudflare account (you) and Cloudflare, as the hosting provider, can see the technical details of requests that any web host sees, such as IP addresses and timestamps, under [Cloudflare's own privacy policy](https://www.cloudflare.com/privacypolicy/). Keep your token secret: anyone who has it can decrypt your notes.

## The phone web app

The phone app is a separate web page served by **your own** worker. It keeps your notes in your phone browser's storage (IndexedDB), remembers your theme in local storage, and caches its own files so it works offline. If you connect it to sync, it behaves exactly as described above.

## What we do not do

- We do not collect, receive or have access to your notes, your token or your server.
- We do not sell or transfer your data to third parties, and we do not use it for any purpose other than running the note-taking and sync features you asked for.
- We do not use or transfer your data to determine creditworthiness or for lending.
- We do not use analytics, advertising, tracking or crash-reporting services.
- We do not load or run code from the internet. All code ships inside the extension package.

## Third parties you may choose to use

- **Cloudflare**, to host your sync server (and GitHub or GitLab, if you use the "Deploy to Cloudflare" button, which copies the project into your own repository). Their terms and policies apply to what you do on their services.
- Links inside the extension that point to this project's GitHub page open only when you click them.

## Keeping or deleting your data

- **Notes on your device:** delete notes in the drawer. Uninstalling the extension removes its local data.
- **Stop syncing:** use **Disconnect this device** in the sync settings. It removes your Worker URL, token and sync state from the extension. Your notes stay on the device.
- **Remove your data from the server:** use **Delete server data** in the sync settings (it removes your encrypted data from your worker and disconnects the device), or delete the worker from your Cloudflare account.

## Children

Note It Down is a general-purpose tool and is not directed at children under 13.

## Changes to this policy

If this policy changes, the updated version will be published in this repository with a new "last updated" date.

## Contact

Questions or concerns: please [open an issue](https://github.com/Shakya47/note-it-down/issues) on the project's GitHub page.
