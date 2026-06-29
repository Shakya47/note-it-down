# Note It Down Sync Worker

An opt-in, zero-knowledge sync backend for the *Note It Down* Chrome extension. This is a stateless Cloudflare Worker acting as an encrypted blob relay. It is content-blind and token-blind, persisting client-side encrypted note databases to Cloudflare KV.

---

## Why Cloudflare Workers & KV?

Deploying your own worker provides a powerful, private sync backend with zero infrastructure overhead.

### Key Benefits
- **Privacy First (Zero-Knowledge)**: Notes are encrypted on your device using derived AES-GCM keys. The worker only stores encrypted blobs and cannot read your note titles or bodies.
- **Serverless & Maintenance Free**: No virtual machines to maintain, no databases to configure, and no operating systems to patch.
- **Global Speed**: Runs on Cloudflare's edge network in over 300 cities. Sync requests execute near-instantly regardless of where you are located.

### Generous Free Tier Details
Cloudflare provides a very generous free tier that is perfect for personal projects:
- **Data Storage**: Up to **1 GB** of free storage in Cloudflare KV. (Even with extensive note taking, an encrypted note database is typically less than 1-2 MBs, meaning you can easily store hundreds of thousands of notes for free).
- **Daily Requests**: Up to **100,000 requests** per day for free.
- **KV Reads**: Up to **100,000 read operations** per day for free.
- **KV Writes**: Up to **1,000 write/delete operations** per day for free. 
  *(Since a typical sync operation performs 1 read and 1 write, you can sync your notes up to 1,000 times a day completely free of charge. Most users sync 5-10 times daily).*

---

## Deployment Instructions

Follow these step-by-step instructions to deploy your own sync worker on your Cloudflare account.

### 1. Prerequisites
Ensure you have Node.js installed, then install the Cloudflare Wrangler CLI globally:
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
Authenticate the Wrangler CLI with your Cloudflare account:
```bash
wrangler login
```

### 3. Create a KV Namespace
Create a Cloudflare KV namespace called `NOTES_KV`:
```bash
wrangler kv namespace create NOTES_KV
```
Make sure to copy the namespace `id` output from the terminal (e.g., `id = "a1b2c3d4..."`).

### 4. Configure wrangler.toml
Copy the example configuration to create your active configuration file:
```bash
cp wrangler.toml.example wrangler.toml
```
Open `wrangler.toml` in your editor and paste the namespace ID you copied in the previous step into the `id` field:
```toml
[[kv_namespaces]]
binding = "NOTES_KV"
id = "PASTE_YOUR_KV_NAMESPACE_ID_HERE"
```

### 5. Deploy the Worker
Deploy the worker code to Cloudflare:
```bash
wrangler deploy
```

### 6. Copy Deployed URL
Upon successful deployment, copy the generated worker URL from the terminal output (e.g., `https://note-it-down-sync.your-subdomain.workers.dev`).

### 7. Configure Extension
- Open the *Note It Down* Chrome extension drawer.
- Navigate to the **Settings** tab.
- Paste the deployed URL into the **Worker URL** field.
- Click **Generate** to create a secure sync token (if you don't have one).
- Click **Save & Sync**.
