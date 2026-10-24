// Offline support: the app shell is cached; sync requests (/v1/...) always go
// to the network. Built assets have content hashes, so cache-first is safe.
const CACHE = 'nid-web-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

// Cache the shell plus every asset the current index.html references; the
// first page load happens before this worker exists, so those requests
// never pass through the fetch handler below.
async function cacheShell() {
  const cache = await caches.open(CACHE)
  const html = await (await fetch('/', { cache: 'no-store' })).text()
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  await cache.addAll([...SHELL, ...assets])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/v1/')) return

  // Pages: network first so updates arrive, cached copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Hashed assets and icons: cache first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
