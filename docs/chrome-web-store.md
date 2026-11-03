# Chrome Web Store submission answers

Ready-to-paste text for the Chrome Web Store developer dashboard (**Privacy practices** tab). Everything here was checked against the code. Re-read it against the dashboard's current wording before submitting, as Google occasionally rewords its forms.

## Single purpose

> Note It Down lets you write notes in a floating, always-on-top window that is available on any web page, and optionally sync those notes between your own devices.

## Permission justifications

The extension requests **no host permissions**, so there is no host-permission justification to write, and none of the permissions below should show a warning at install time.

**`storage`**
> Stores the user's notes and settings (theme, and the optional sync configuration) locally in chrome.storage.local. This is the core of the extension: without it, notes cannot be saved.

**`unlimitedStorage`**
> Notes are kept in chrome.storage.local, which is limited to about 10 MB without this permission. People who keep many or long notes would reach that limit and saves would start failing. This permission only lifts that cap; it is not used for anything else.

**`activeTab`**
> When the user clicks the toolbar icon, this gives the extension temporary access to the current tab so it can show its note drawer on that page, and so it can check the page address to tell whether Chrome allows extensions there (for example chrome:// pages). The extension does not read page content, and the access lasts only for that tab until it navigates or closes.

**`scripting`**
> After the user clicks the toolbar icon, the extension calls chrome.scripting.executeScript once to inject its own packaged script (content.js), which draws the note drawer on that page. The extension has no always-on content scripts, so it never runs on a page until the user asks. Only the file packaged inside the extension is injected; no remote or dynamically generated code is used.

**`alarms`**
> Wakes the background service worker every 5 minutes so notes stay in step across the user's own devices when they have turned on sync. It does nothing if sync is not set up.

## Remote code

**No, I am not using remote code.** All JavaScript is bundled inside the extension package. The extension never loads or evaluates code from the network.

## Data usage

Select only what applies. The extension has no developer-run server and sends nothing to the developer.

| Category | Declare? | Why |
| :--- | :--- | :--- |
| Personally identifiable information | No | No name, address, email or similar is collected. |
| Health information | No | |
| Financial and payment information | No | |
| **Authentication information** | **Yes (conservative)** | The optional sync token is a secret key stored in the extension's local storage and used to encrypt and authorize sync. It is never sent to the developer or any third party. Declare it to be safe; if the dashboard's definition covers only data transmitted off the device, you may leave it unchecked. |
| Personal communications | No | |
| Location | No | |
| Web history | No | The page address is checked locally at click time and never stored or sent. |
| User activity | No | No tracking or analytics. |
| Website content | No | The extension never reads page content. |

Users' notes are content they write themselves. They stay on the device, and if sync is turned on they travel encrypted to a server the user owns, never to the developer.

**Certifications** (all three are true; tick all three):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

```
https://github.com/Shakya47/note-it-down/blob/main/PRIVACY.md
```

The link only works once `PRIVACY.md` is committed and pushed to `main`. Paste it into the dashboard's **Privacy policy** field.

## Before you submit

1. **Build a fresh package.** The `note-it-down-v1.0.0.zip` in the repository root is out of date (it predates sync). Make a new one from the built extension, zipping the *contents* of `dist`, not the folder itself:
   ```bash
   pnpm build
   cd dist && zip -r ../note-it-down-1.0.0.zip . && cd ..
   ```
   Don't commit the zip.
2. **Version.** `manifest.json` says `1.0.0`. Increase it for every later upload; the Store rejects a repeated version.
3. **Store listing assets.** The Store icon is `public/icons/icon128.png` (128×128, transparent, already in the package; the vector source is `docs/store/icon.svg`). Five ready-made 1280×800 screenshots are in [`docs/store/`](store/); upload them in numeric order (the first is the one shown most prominently). You still need to write the description. A small promo tile (440×280) is optional.
4. **Developer account.** One-time registration fee (US$5) and a verified contact email in the dashboard.
5. **After approval:** done. The Store link is in the README's Quick start: https://chromewebstore.google.com/detail/mjehcejdcfanadklffmdifdmpdacfmie
