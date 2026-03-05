<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { getCacheSize, clearTileCache, clearAllCaches, checkForSwUpdate, activateSwUpdate, prefetchTiles, prefetchGpxTracks } from '$lib/services/sw-messenger';
  import type { CacheSizeResult } from '$lib/services/sw-messenger';
  import { AUTO_TRACKS, REPO_RAW_BASE } from '$lib/stores/tracks.svelte';

  let cacheInfo    = $state<CacheSizeResult | null>(null);
  let checking     = $state(false);
  let updateAvail  = $state(false);
  let downloading  = $state(false);

  async function loadCacheInfo() {
    cacheInfo = await getCacheSize();
  }

  async function checkUpdate() {
    checking = true;
    try {
      updateAvail = await checkForSwUpdate();
      if (!updateAvail) app.toast('App ist aktuell', 'info');
    } finally {
      checking = false;
    }
  }

  /** Lädt alle Tiles des aktuellen Kartenausschnitts (±1 Zoom-Level) herunter */
  async function downloadRegion() {
    if (!mapStore.map) { app.toast('Karte nicht bereit', 'warn'); return; }
    downloading = true;
    try {
      const m      = mapStore.map;
      const bounds = m.getBounds();
      const zoom   = m.getZoom();
      const center = m.getCenter();
      const tiles: Array<{ url: string; x: number; y: number; z: number }> = [];

      // ±1 Zoom-Level, aktueller View
      for (const dz of [-1, 0, 1]) {
        const z  = Math.max(1, Math.min(18, zoom + dz));
        const nw = _ll2tile(bounds.getNorth(), bounds.getWest(), z);
        const se = _ll2tile(bounds.getSouth(), bounds.getEast(), z);
        for (let x = nw.x; x <= se.x; x++) {
          for (let y = nw.y; y <= se.y; y++) {
            tiles.push({
              url: `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
              x, y, z
            });
          }
        }
      }

      // Center-out Sortierung (wichtigste Tiles zuerst)
      const cx = _ll2tile(center.lat, center.lng, zoom).x;
      const cy = _ll2tile(center.lat, center.lng, zoom).y;
      tiles.sort((a, b) =>
        Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)
      );

      const batch = tiles.slice(0, 600);
      await prefetchTiles({ tiles: batch });
      app.toast(`${batch.length} Tiles heruntergeladen`, 'success');
      await loadCacheInfo();
    } catch (e) {
      app.toast(`Download-Fehler: ${e}`, 'error');
    } finally {
      downloading = false;
    }
  }

  /** Lädt alle GMTW GPX-Tracks vor */
  async function downloadAllGpx() {
    downloading = true;
    try {
      const urls = AUTO_TRACKS.map(t => REPO_RAW_BASE + t.file);
      await prefetchGpxTracks(urls);
      app.toast(`${urls.length} GPX-Tracks gecacht`, 'success');
      await loadCacheInfo();
    } catch (e) {
      app.toast(`GPX-Fehler: ${e}`, 'error');
    } finally {
      downloading = false;
    }
  }

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  function _ll2tile(lat: number, lng: number, z: number) {
    const n = 2 ** z;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  }

  $effect(() => { loadCacheInfo(); });
</script>

<div style="padding-top:0.75rem;display:flex;flex-direction:column;gap:0.75rem">

  <!-- App Info -->
  <div class="card card-sm">
    <div class="form-label mb-1">GMTW Trail Map</div>
    <div class="text-sm text-dim">
      <div>Version: 2026.03</div>
      <div>Offline-PWA für das German Muni Trail Weekend</div>
    </div>
  </div>

  <!-- SW Update -->
  <div class="card">
    <div class="form-label mb-2">App-Updates</div>
    {#if updateAvail}
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
        <span class="text-sm">🆕 Update verfügbar!</span>
      </div>
      <button class="btn btn-primary w-full" onclick={activateSwUpdate}>🔄 Jetzt aktualisieren</button>
    {:else}
      <button class="btn btn-secondary w-full" onclick={checkUpdate} disabled={checking}>
        {checking ? '⏳ Prüfe...' : '🔍 Nach Updates suchen'}
      </button>
    {/if}
  </div>

  <!-- Region Pre-Download -->
  <div class="card">
    <div class="form-label mb-2">🗺 Region vorherunterladen</div>
    <p class="text-sm text-dim mb-2">Tiles des aktuellen Kartenausschnitts offline verfügbar machen.</p>
    <div style="display:flex;gap:0.5rem">
      <button class="btn btn-secondary flex-1" onclick={downloadRegion} disabled={downloading}>
        {downloading ? '⏳ Lade...' : '📥 Tiles herunterladen'}
      </button>
      <button class="btn btn-secondary flex-1" onclick={downloadAllGpx} disabled={downloading}>
        {downloading ? '⏳' : '📥 GPX-Tracks'}
      </button>
    </div>
  </div>

  <!-- Cache Info -->
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
      <div class="form-label">Offline-Cache</div>
      <button class="btn btn-ghost btn-sm" onclick={loadCacheInfo}>↻</button>
    </div>
    {#if cacheInfo}
      <div style="display:flex;flex-direction:column;gap:0.2rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm">App-Shell</span>
          <span class="text-sm font-head">{formatBytes(cacheInfo.shellCache)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm">Karten-Tiles ({cacheInfo.tileCount})</span>
          <span class="text-sm font-head">{formatBytes(cacheInfo.tileCache)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm">GPX-Tracks ({cacheInfo.gpxCount})</span>
          <span class="text-sm font-head">{formatBytes(cacheInfo.gpxCache)}</span>
        </div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm font-head">Gesamt</span>
          <span class="text-sm font-head text-accent">{formatBytes(cacheInfo.totalBytes)}</span>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
        <button class="btn btn-secondary flex-1" onclick={async () => {
          if (confirm('Tile-Cache leeren?')) {
            await clearTileCache();
            await loadCacheInfo();
            app.toast('Tile-Cache geleert', 'info');
          }
        }}>🗺 Tiles leeren</button>
        <button class="btn btn-danger flex-1" onclick={async () => {
          if (confirm('Alle Caches leeren? App muss neu geladen werden.')) {
            await clearAllCaches();
            app.toast('Caches geleert — Neu laden empfohlen', 'warn', 5000);
          }
        }}>🗑 Alles leeren</button>
      </div>
    {:else}
      <p class="text-sm text-dim">Lade Cache-Infos...</p>
    {/if}
  </div>

  <!-- Keyboard Shortcuts -->
  <div class="card card-sm">
    <div class="form-label mb-2">Tastaturkürzel</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.2rem 1rem">
      {#each [['V','Kartenübersicht'],['N','Nächster Punkt'],['S','Einstellungen'],['G','GPS'],['Esc','Schließen']] as [key, desc]}
        <kbd style="font-family:monospace;background:var(--s2);padding:0.1rem 0.4rem;border-radius:var(--r);font-size:0.85rem">{key}</kbd>
        <span class="text-sm">{desc}</span>
      {/each}
    </div>
  </div>

</div>
