/*
 * Might's service worker: keeps the app itself on the phone so it opens instantly and offline.
 *   pages    – network first, falling back to the cached app shell when offline
 *   /assets/ – cache first; Vite gives these hashed names, so a cached copy never goes stale
 *   the rest – served from cache and refreshed in the background
 * Requests to other origins (Supabase) and anything but GET go straight to the network untouched.
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = 'might-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // every route is the same index.html, so keep the latest copy under '/'
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((cache) => cache.put('/', res.clone()))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request)
      const fresh = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone())
        return res
      })
      if (url.pathname.startsWith('/assets/')) return cached ?? fresh
      fresh.catch(() => {})
      return cached ?? fresh
    }),
  )
})
