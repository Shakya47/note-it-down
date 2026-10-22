export interface SyncConfig {
  serverUrl: string;
  token: string;
}

/** Tokens produced by generateToken(): 32 random bytes, base64url, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isStrongToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Returns the normalised worker base URL, or throws a user-facing error.
 * Requires an absolute https:// URL (http:// only for local `wrangler dev`),
 * so a scheme-less value can never resolve against some other origin.
 */
export function normalizeServerUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Worker URL must be a full URL, e.g. https://note-it-down-sync.you.workers.dev');
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error('Worker URL must start with https://');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Worker URL must not contain credentials, a query string or a fragment');
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}
