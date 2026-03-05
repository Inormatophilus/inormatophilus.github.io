/// <reference lib="webworker" />

// vite-plugin-pwa injects the precache manifest into self.__WB_MANIFEST
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
const PRECACHE_MANIFEST: string[] = self.__WB_MANIFEST?.map(e => e.url) ?? [];

// =============================================================================
// GMTW Trail Map — Service Worker (TypeScript)
// Cache Version: gmtw-v9
//
// Caches:
// - CACHE_SHELL : App-Shell (HTML/JS/CSS/Icons) — Cache-First
// - CACHE_TILES : Karten-Tiles (OTM/Esri) — Stale-While-Revalidate + Dedup
// - CACHE_DATA  : API-Daten — Stale-While-Revalidate
// - CACHE_GPX   : GPX-Tracks — Cache-First + Background-Revalidate
// - CACHE_FONTS : Bunny Fonts — Stale-While-Revalidate
//
// Messages:
// - SKIP_WAITING, PREFETCH_TILES, PREFETCH_GPX, GET_CACHE_SIZE,
//   CLEAR_TILE_CACHE, CLEAR_ALL_CACHES
// =============================================================================

const VERSION     = 'v9';
const CACHE_SHELL = `gmtw-shell-${VERSION}`;
const CACHE_TILES = 'gmtw-tiles-v9';
const CACHE_DATA  = `gmtw-data-${VERSION}`;
const CACHE_GPX   = 'gmtw-gpx-v9';
const CACHE_FONTS = 'gmtw-fonts-v9';

const MAX_TILES     = 3000;
const MAX_GPX       = 200;
const TRIM_BATCH    = 50;   // trim every N inserts

const TILE_ORIGINS  = ['tile.opentopomap.org', 'arcgisonline.com', 'openstreetmap.org'];
const FONT_ORIGINS  = ['fonts.bunny.net'];
const GPX_EXTS      = ['.gpx', '.kml', '.geojson'];

// Transparent 1×1 PNG (fallback für Tile-Cache-Miss im Offline-Modus)
const TRANSPARENT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Deduplizierung laufender Tile-Revalidierungen
const _bgFetching = new Set<string>();
// Tile-Insert-Counter für Batched Trim
let _tileInserts  = 0;
let _gpxInserts   = 0;

// =============================================================================
// Install
// =============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // Precache shell assets injected by vite-plugin-pwa
      await cache.addAll(PRECACHE_MANIFEST);
      await self.skipWaiting();
    })()
  );
});

// =============================================================================
// Activate — Clean up old caches
// =============================================================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = [CACHE_SHELL, CACHE_TILES, CACHE_DATA, CACHE_GPX, CACHE_FONTS];
      await Promise.all(
        keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// =============================================================================
// Fetch
// =============================================================================

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // --- Fonts ---
  if (FONT_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(_staleWhileRevalidate(req, CACHE_FONTS));
    return;
  }

  // --- Tile URLs ---
  if (TILE_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(_tileStrategy(req));
    return;
  }

  // --- GPX / Track files ---
  if (GPX_EXTS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(_gpxStrategy(req));
    return;
  }

  // --- App Shell ---
  if (url.origin === self.location.origin) {
    event.respondWith(_shellStrategy(req));
    return;
  }
});

// =============================================================================
// Tile Strategy: SWR + Dedup
// =============================================================================

async function _tileStrategy(req: Request): Promise<Response> {
  const cache    = await caches.open(CACHE_TILES);
  const cached   = await cache.match(req);
  const cacheKey = req.url;

  if (cached) {
    // Background revalidate (dedup prevents parallel re-fetches for same tile)
    if (!_bgFetching.has(cacheKey)) {
      _bgFetching.add(cacheKey);
      fetch(req.clone())
        .then(async (fresh) => {
          if (fresh.ok) {
            await cache.put(req, fresh);
            _tileInserts++;
            if (_tileInserts >= TRIM_BATCH) {
              _tileInserts = 0;
              _trimCache(cache, MAX_TILES);
            }
          }
        })
        .catch(() => {/* ignore offline revalidation failures */})
        .finally(() => { _bgFetching.delete(cacheKey); });
    }
    return cached;
  }

  // Not cached — try network, fallback to transparent PNG
  try {
    const fresh = await fetch(req.clone());
    if (fresh.ok) {
      await cache.put(req, fresh.clone());
      _tileInserts++;
      if (_tileInserts >= TRIM_BATCH) {
        _tileInserts = 0;
        _trimCache(cache, MAX_TILES);
      }
    }
    return fresh;
  } catch {
    // Offline fallback
    return _transparentPng();
  }
}

// =============================================================================
// GPX Strategy: Cache-First + Background-Revalidate
// =============================================================================

async function _gpxStrategy(req: Request): Promise<Response> {
  const cache  = await caches.open(CACHE_GPX);
  const cached = await cache.match(req);
  if (cached) {
    // Background update
    fetch(req.clone())
      .then(async fresh => {
        if (fresh.ok) {
          await cache.put(req, fresh);
          _gpxInserts++;
          if (_gpxInserts >= TRIM_BATCH) {
            _gpxInserts = 0;
            _trimCache(cache, MAX_GPX);
          }
        }
      })
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetch(req.clone());
    if (fresh.ok) await cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response('GPX not available offline', { status: 503 });
  }
}

// =============================================================================
// Shell Strategy: Cache-First, fallback offline page
// =============================================================================

async function _shellStrategy(req: Request): Promise<Response> {
  const cache  = await caches.open(CACHE_SHELL);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) await cache.put(req, fresh.clone());
    return fresh;
  } catch {
    // For navigation requests, return offline shell
    if (req.mode === 'navigate') {
      const shell = await cache.match('/') ?? await cache.match('/index.html');
      if (shell) return shell;
      return _offlinePage();
    }
    return new Response('Offline', { status: 503 });
  }
}

// =============================================================================
// SWR helper
// =============================================================================

async function _staleWhileRevalidate(req: Request, cacheName: string): Promise<Response> {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fresh$ = fetch(req.clone()).then(async r => {
    if (r.ok) await cache.put(req, r.clone());
    return r;
  }).catch(() => null);

  return cached ?? (await fresh$) ?? new Response('Offline', { status: 503 });
}

// =============================================================================
// Messages
// =============================================================================

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = (event.data ?? {}) as { type: string; payload: unknown };
  const port = event.ports?.[0];

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'PREFETCH_TILES':
      _prefetchTiles(payload as { tiles: Array<{ url: string }> });
      break;

    case 'PREFETCH_GPX':
      _prefetchGpx(payload as { urls: string[] });
      break;

    case 'GET_CACHE_SIZE':
      _getCacheSize().then(data => port?.postMessage({ success: true, data }));
      break;

    case 'CLEAR_TILE_CACHE':
      caches.delete(CACHE_TILES)
        .then(() => port?.postMessage({ success: true }));
      break;

    case 'CLEAR_ALL_CACHES':
      Promise.all([
        caches.delete(CACHE_SHELL),
        caches.delete(CACHE_TILES),
        caches.delete(CACHE_DATA),
        caches.delete(CACHE_GPX),
        caches.delete(CACHE_FONTS),
      ]).then(() => port?.postMessage({ success: true }));
      break;
  }
});

// =============================================================================
// Prefetch Helpers
// =============================================================================

async function _prefetchTiles(payload: { tiles: Array<{ url: string }> }): Promise<void> {
  if (!payload?.tiles) return;
  const cache = await caches.open(CACHE_TILES);
  const urls  = payload.tiles.map(t => t.url);

  // 6er Batches
  for (let i = 0; i < urls.length; i += 6) {
    const batch = urls.slice(i, i + 6);
    await Promise.allSettled(
      batch.map(async url => {
        if (await cache.match(url)) return; // bereits gecacht
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
      })
    );
    await _trimCache(cache, MAX_TILES);
  }
}

async function _prefetchGpx(payload: { urls: string[] }): Promise<void> {
  if (!payload?.urls) return;
  const cache = await caches.open(CACHE_GPX);
  await Promise.allSettled(
    payload.urls.map(async url => {
      if (await cache.match(url)) return;
      const resp = await fetch(url);
      if (resp.ok) await cache.put(url, resp);
    })
  );
  await _trimCache(cache, MAX_GPX);
}

// =============================================================================
// Cache Size
// =============================================================================

async function _getCacheSize(): Promise<{
  tileCache: number; gpxCache: number; shellCache: number;
  totalBytes: number; tileCount: number; gpxCount: number;
}> {
  const [tileKeys, gpxKeys, shellKeys] = await Promise.all([
    (await caches.open(CACHE_TILES)).keys(),
    (await caches.open(CACHE_GPX)).keys(),
    (await caches.open(CACHE_SHELL)).keys(),
  ]);
  // Simple size estimation via content-length headers
  async function cacheBytes(name: string): Promise<number> {
    const c = await caches.open(name);
    const keys = await c.keys();
    let total = 0;
    for (const k of keys) {
      const r = await c.match(k);
      if (r) {
        const cl = r.headers.get('content-length');
        total += cl ? parseInt(cl) : 0;
      }
    }
    return total;
  }
  const [tileCache, gpxCache, shellCache] = await Promise.all([
    cacheBytes(CACHE_TILES),
    cacheBytes(CACHE_GPX),
    cacheBytes(CACHE_SHELL),
  ]);
  return {
    tileCache,
    gpxCache,
    shellCache,
    totalBytes: tileCache + gpxCache + shellCache,
    tileCount:  tileKeys.length,
    gpxCount:   gpxKeys.length,
  };
}

// =============================================================================
// Trim Cache (LRU approximation — remove oldest entries)
// =============================================================================

async function _trimCache(cache: Cache, maxEntries: number): Promise<void> {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

// =============================================================================
// Fallbacks
// =============================================================================

function _transparentPng(): Response {
  const binary = atob(TRANSPARENT_PNG.split(',')[1]);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes.buffer, {
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length) }
  });
}

function _offlinePage(): Response {
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>GMTW — Offline</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0e14;color:#e2e8f0;margin:0;text-align:center}h1{color:#c8ff00}p{color:#94a3b8}</style>
</head><body><div><h1>GMTW Trail Map</h1><p>Du bist offline. Bitte verbinde dich mit dem Internet und öffne die App erneut.</p></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
