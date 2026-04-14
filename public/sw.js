const CACHE = 'beeme-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  // Só cacheia GET requests de assets estáticos
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')
  if (!isStatic) return

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          cache.put(e.request, res.clone())
          return res
        })
      })
    )
  )
})
