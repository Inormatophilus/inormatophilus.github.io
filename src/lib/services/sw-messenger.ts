// =============================================================================
// GMTW Trail Map — Service Worker Message Bridge
//
// Sendet typsichere Nachrichten an den aktiven Service Worker.
// Empfängt Antworten via MessageChannel (Promise-basiert).
//
// Unterstützte SW-Nachrichten:
// - PREFETCH_TILES  — Tile-Precaching für Offline-Betrieb
// - PREFETCH_GPX   — GPX-Track Precaching
// - GET_CACHE_SIZE  — Cache-Größe abfragen
// - CLEAR_TILE_CACHE — Tile-Cache leeren
// - CLEAR_ALL_CACHES — Alle Caches leeren
// - SKIP_WAITING   — Update sofort aktivieren
// =============================================================================

import type { SwMessageType } from '$lib/types';

interface SwMessage {
  type: SwMessageType;
  payload?: unknown;
}

interface SwResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core Messenger
// ---------------------------------------------------------------------------

/**
 * Sendet eine Nachricht an den aktiven Service Worker.
 * Gibt eine Promise<SwResponse> zurück, die bei Timeout (5s) rejected wird.
 */
export async function sendToSW(
  type: SwMessageType,
  payload?: unknown,
  timeoutMs = 5000
): Promise<SwResponse> {
  const reg = await getActiveRegistration();
  if (!reg?.active) {
    return { success: false, error: 'Service Worker nicht aktiv' };
  }

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      reject(new Error(`SW-Nachricht Timeout: ${type}`));
    }, timeoutMs);

    channel.port1.onmessage = (evt: MessageEvent<SwResponse>) => {
      clearTimeout(timer);
      resolve(evt.data);
    };

    const msg: SwMessage = { type, payload };
    reg.active!.postMessage(msg, [channel.port2]);
  });
}

/**
 * Sendet eine Nachricht ohne auf Antwort zu warten (fire-and-forget).
 */
export async function postToSW(type: SwMessageType, payload?: unknown): Promise<void> {
  const reg = await getActiveRegistration();
  if (!reg?.active) return;
  reg.active.postMessage({ type, payload });
}

async function getActiveRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Typed API — Tile Precaching
// ---------------------------------------------------------------------------

export interface TilePrefetchPayload {
  tiles: Array<{ url: string; x: number; y: number; z: number }>;
}

/**
 * Sendet eine Batch-Liste an Tile-URLs zum Precachen an den SW.
 * Der SW verarbeitet die Tiles in 6er-Gruppen und ignoriert Duplikate.
 */
export async function prefetchTiles(payload: TilePrefetchPayload): Promise<void> {
  await postToSW('PREFETCH_TILES', payload);
}

// ---------------------------------------------------------------------------
// Typed API — GPX Precaching
// ---------------------------------------------------------------------------

export interface GpxPrefetchPayload {
  urls: string[];
}

/**
 * Sendet GPX-URLs an den SW zum aggressiven Precachen.
 */
export async function prefetchGpxTracks(urls: string[]): Promise<void> {
  await postToSW('PREFETCH_GPX', { urls });
}

// ---------------------------------------------------------------------------
// Typed API — Cache Info
// ---------------------------------------------------------------------------

export interface CacheSizeResult {
  tileCache: number;    // Bytes
  gpxCache: number;     // Bytes
  shellCache: number;   // Bytes
  totalBytes: number;
  tileCount: number;
  gpxCount: number;
}

/**
 * Fragt den SW nach Cache-Größen.
 */
export async function getCacheSize(): Promise<CacheSizeResult | null> {
  try {
    const resp = await sendToSW('GET_CACHE_SIZE', undefined, 8000);
    if (resp.success && resp.data) {
      return resp.data as CacheSizeResult;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Typed API — Cache Management
// ---------------------------------------------------------------------------

/**
 * Leert den Tile-Cache im SW.
 */
export async function clearTileCache(): Promise<boolean> {
  try {
    const resp = await sendToSW('CLEAR_TILE_CACHE');
    return resp.success;
  } catch {
    return false;
  }
}

/**
 * Leert ALLE Caches im SW (Shell + Tiles + Data + GPX + Fonts).
 * ACHTUNG: App wird offline unbrauchbar bis zum nächsten Seitenaufruf.
 */
export async function clearAllCaches(): Promise<boolean> {
  try {
    const resp = await sendToSW('CLEAR_ALL_CACHES');
    return resp.success;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Typed API — Update
// ---------------------------------------------------------------------------

/**
 * Aktiviert einen wartenden SW-Update sofort (skipWaiting).
 * Seite sollte danach neu geladen werden.
 */
export async function activateSwUpdate(): Promise<void> {
  await postToSW('SKIP_WAITING');
  // Kurz warten, dann reload
  await new Promise(resolve => setTimeout(resolve, 200));
  window.location.reload();
}

/**
 * Prüft ob ein SW-Update verfügbar ist (waiting state).
 */
export async function checkForSwUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await reg.update();
    return !!reg.waiting;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SW Message Listener (eingehende Broadcasts vom SW)
// ---------------------------------------------------------------------------

export type SwBroadcastHandler = (msg: SwMessage) => void;

const broadcastHandlers: SwBroadcastHandler[] = [];

/**
 * Registriert einen Handler für eingehende SW-Broadcast-Nachrichten.
 * Wird aufgerufen für z.B. CACHE_UPDATED, OFFLINE_READY etc.
 */
export function onSwBroadcast(handler: SwBroadcastHandler): () => void {
  broadcastHandlers.push(handler);
  return () => {
    const idx = broadcastHandlers.indexOf(handler);
    if (idx >= 0) broadcastHandlers.splice(idx, 1);
  };
}

// SW-Broadcast-Listener initialisieren (einmalig)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (evt: MessageEvent<SwMessage>) => {
    for (const handler of broadcastHandlers) {
      handler(evt.data);
    }
  });
}

// ---------------------------------------------------------------------------
// Tile Precache Helper (Main-Thread Debounced)
// ---------------------------------------------------------------------------

interface TileCoord { x: number; y: number; z: number }

let _tpcTimer: ReturnType<typeof setTimeout> | null = null;
let _tpcPendingTiles: Array<TileCoord & { url: string }> = [];

/**
 * Puffert Tile-URLs und sendet sie nach 1.4s Debounce an den SW.
 * Sortiert center-out (prioritisiert sichtbare Tiles zuerst).
 */
export function enqueueTilePrefetch(
  tiles: Array<TileCoord & { url: string }>
): void {
  _tpcPendingTiles.push(...tiles);

  if (_tpcTimer) clearTimeout(_tpcTimer);
  _tpcTimer = setTimeout(() => {
    // Deduplizieren
    const seen = new Set<string>();
    const deduped = _tpcPendingTiles.filter(t => {
      if (seen.has(t.url)) return false;
      seen.add(t.url);
      return true;
    });
    _tpcPendingTiles = [];

    // Max 600 Tiles pro Batch
    const batch = deduped.slice(0, 600);
    if (batch.length > 0) {
      prefetchTiles({ tiles: batch });
    }
  }, 1400);
}
