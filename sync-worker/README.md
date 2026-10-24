# Note It Down Sync Worker

Your own sync server for *Note It Down*, running on Cloudflare's free plan. It does two things at one URL:

- **`/v1/...`**: a mailbox that stores one **encrypted** copy of your notes per sync ID. It can't read your notes or your token.
- **`/`**: serves the phone app (built from `web/`).

Each sync ID lives in its own SQLite-backed Durable Object. That gives strongly consistent storage, and two devices uploading at the same moment can't overwrite each other: one wins, the other re-merges and retries.

---

## Deploy (once)

The worker runs on **your own** Cloudflare account (the free plan is enough). Pick one way:

### Option A: one click (about 5 minutes, no terminal)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Shakya47/note-it-down)

1. Click the button. Sign in to (or create) a free Cloudflare account, and connect GitHub or GitLab when asked.
2. Keep the suggested settings and click **Create and deploy**. Cloudflare copies this project into your own repository, builds the phone app and deploys everything.
3. When it finishes, copy your worker URL, e.g. `https://note-it-down-sync.<your-subdomain>.workers.dev`.

From then on, every push to your copy of the repository redeploys automatically.

### Option B: from a terminal (about 10 minutes)
From the repository root:
```bash
pnpm install
npx wrangler login
pnpm run deploy
```
`pnpm run deploy` builds the phone app into `sync-worker/public/` and uploads it together with `worker.js`, using `wrangler.toml` at the repo root. There's nothing to fill in. The last lines print your URL. (Use `pnpm run deploy`: plain `pnpm deploy` is a different, built-in pnpm command.)

### Connect the extension
1. Open the drawer → **☁️ Sync** → **Set up sync**.
2. Paste the worker URL.
3. Click **Generate** to create your sync token, then **Copy** it somewhere safe (a password manager is ideal).
4. Click **Save & Sync**.

### Connect your phone
1. Open the worker URL on your phone.
2. Tap ⚙️. The Worker URL is filled in; paste the **same** token.
3. Check the **Sync ID** matches the one in the extension, then tap **Save & Sync**.
4. Install it: iPhone → Safari → Share → **Add to Home Screen**. Android → Chrome → ⋮ → **Install app**.

Other computers: install the extension and repeat **Connect the extension**, pasting the same token instead of generating a new one.

> **Why copy the token by hand?** We considered pairing devices by scanning a QR code, but the code *is* your token: anyone who sees it, photographs it, or catches it on a screen share could read all your notes, and the link it opens can end up in the phone's browser history. Sorry for the extra step — copying the token manually (ideally through a password manager) is the safest option for now.

---

## Updating

- **Option A:** bring the new code into your copy of the repository (or pull it into a local clone and push). Cloudflare redeploys on every push.
- **Option B:** pull the new code and run `pnpm run deploy` again.

Your URL, token and notes stay the same either way.

### Upgrading from the old KV-based worker

Earlier versions stored data in Workers KV, which could serve stale data and let one device overwrite another's upload. To upgrade, uncomment the `[[kv_namespaces]]` block at the bottom of the root `wrangler.toml`, put in your KV namespace id, and run `pnpm run deploy`. Each sync ID's data moves into the Durable Object automatically the first time a device syncs. Once all your devices have synced, you can remove the KV block.

---

## Optional hardening

**Only accept your own sync IDs.** Anyone who finds your worker URL could store data on it (they can't read or change yours). To lock it down, copy the full sync ID from the extension's sync settings (**Advanced**). In the Cloudflare dashboard open your worker → **Settings** → **Variables and Secrets** → add a variable named `ALLOWED_ADDRESSES` with that ID (separate several with commas). Other IDs get `403`. It survives redeploys (`keep_vars` in `wrangler.toml`).

**Limits.** Uploads are capped at 20 MB of encrypted data. **Delete server data** in sync settings permanently removes your data from the worker.

---

## Shorter URL

Custom domains work: add one in the Cloudflare dashboard (Workers & Pages → your worker → Settings → Domains & Routes), then update the Worker URL on each device. The token stays the same.

## Local development

`npx wrangler dev` at the repo root (after `pnpm build:web`) runs the worker at `http://localhost:8787`. The extension and phone app accept `http://localhost` URLs for testing.
