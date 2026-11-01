# Chrome Web Store listing text

Paste these into the **Store listing** tab. The Chrome Web Store shows the description as **plain text** (no Markdown), so the formatting below uses capital-letter headings and `•` bullets, which display correctly.

## Name

```
Note It Down
```

## Summary (132 characters max)

The Store takes this from `description` in `manifest.json`, which already contains exactly this text (118 characters). You don't paste it anywhere.

```
Floating, always-on-top notes on any page. Optional end-to-end encrypted sync to your phone, through a server you own.
```

## Description

```
Note It Down keeps your notes one click away on every page, and lets any note float above everything else while you work.

HOW IT WORKS
• Click the toolbar icon on any page to slide open your notes drawer.
• Click a note to pop it out into a floating, always-on-top Picture-in-Picture window. It stays in front when you switch tabs, so you can keep writing while you read, research or work.
• Notes save as you type and work fully offline.
• Light and dark themes.

PRIVATE SYNC THAT YOU OWN (OPTIONAL)
• Sync is off by default. Turn it on to see the same notes on your other computers and on your phone.
• Your notes are encrypted on your device (AES-256) before they leave it. Only encrypted data is ever sent.
• Sync runs on a tiny Cloudflare Worker that you deploy to your own free Cloudflare account. There is a one-click deploy button, so no coding is needed. There is no account with me and no server of mine in the middle: I never see your notes.
• Only your secret token can unlock your notes, and it never leaves your devices.
• Edits are merged safely. If the same note is changed on two devices, both versions are kept, so nothing is silently lost.

PHONE APP
• The same notes on your phone, through a small web app served by your own worker.
• Install it to your home screen (iPhone: Share → Add to Home Screen; Android: Install app). It works offline and syncs when you are back online.

PRIVACY
• No analytics, no ads, no tracking, no accounts.
• No remote code: everything runs from the extension package.
• The only network requests are to the sync server you set up yourself, and only if you turn sync on.
• The drawer only appears on a page when you click the icon.

GOOD TO KNOW
• Requires Chrome 116 or newer (needed for the floating Picture-in-Picture window).
• Chrome blocks extensions on chrome:// pages and on the Chrome Web Store, so the drawer can't open there.
• On plain http:// pages, where Chrome doesn't offer Picture-in-Picture, the note opens inside the drawer instead.

OPEN SOURCE (MIT)
Source code, setup guide and the sync worker: https://github.com/Shakya47/note-it-down
Privacy policy: https://github.com/Shakya47/note-it-down/blob/main/PRIVACY.md

Setting up sync takes about 10 minutes (the README walks through it). Notes work straight after installing, with no setup at all.
```

## Other fields

| Field | Value |
| :--- | :--- |
| Category | Productivity |
| Language | English |
| Official URL / Homepage | `https://github.com/Shakya47/note-it-down` |
| Support URL | `https://github.com/Shakya47/note-it-down/issues` |
| Screenshots | The five files in this folder, in numeric order |
| Promo video (optional) | Upload your launch video to YouTube and paste the link. |
