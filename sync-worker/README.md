# Note It Down Sync Worker

An opt-in, zero-knowledge sync backend for the *Note It Down* Chrome extension. This is a stateless Cloudflare Worker acting as an encrypted blob relay. It is content-blind and token-blind, persisting client-side encrypted note databases to Cloudflare KV.

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
