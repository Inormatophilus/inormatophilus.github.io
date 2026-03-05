<script lang="ts">
  import { markersStore } from '$lib/stores/markers.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { encodeMarkerQr } from '$lib/services/qr-engine';
  import QRDisplay from '../qr/QRDisplay.svelte';

  const loc  = $derived(markersStore.selectedLoc);
  const open = $derived(loc !== null);

  function close() {
    markersStore.clearLocSelection();
  }

  function flyToMarker() {
    if (!loc) return;
    mapStore.flyTo(loc.lat, loc.lng, 18);
    close();
  }

  function openInMaps() {
    if (!loc) return;
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const url = isIos
      ? `maps://maps.apple.com/?q=${loc.lat},${loc.lng}`
      : `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
    window.open(url, '_blank');
  }

  function catLabel(cat: string): string {
    const m: Record<string, string> = {
      beginner: 'Beginner',
      mittel: 'Mittel',
      expert: 'Expert',
      'optional-logistik': 'Logistik',
      custom: 'Eigene',
    };
    return m[cat] ?? cat;
  }

  const displayName = $derived(
    loc ? (loc._overrideName ?? (loc.nameI18n?.[app.lang] ?? loc.name)) : ''
  );
  const displayDesc = $derived(
    loc ? (loc.descI18n?.[app.lang] ?? loc.desc ?? '') : ''
  );
  const displayEmoji = $derived(
    loc ? (loc._overrideEmoji ?? loc.emoji) : ''
  );

  let showQr   = $state(false);
  let qrChunks = $state<string[]>([]);

  function toggleQr() {
    if (!loc) return;
    if (showQr) { showQr = false; return; }
    qrChunks = [encodeMarkerQr(loc.lat, loc.lng, displayName)];
    showQr   = true;
  }

  $effect(() => {
    // Reset QR when marker changes
    if (!loc) { showQr = false; qrChunks = []; }
  });
</script>

<!-- Backdrop -->
{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="ls-backdrop" onclick={close} role="presentation"></div>
{/if}

<!-- Sheet -->
<div class="loc-sheet" class:open>
  <div class="ls-handle-row">
    <div class="ls-handle"></div>
  </div>

  {#if loc}
    <!-- Header -->
    <div class="ls-header">
      <span class="ls-emoji" style="background:{loc.color}">{displayEmoji}</span>
      <div class="ls-info">
        <span class="ls-name">{displayName}</span>
        <span class="ls-cat" style="color:{loc.color}">{catLabel(loc.cat)}</span>
      </div>
      <button class="ls-close" onclick={close} aria-label="Schließen">✕</button>
    </div>

    {#if displayDesc}
      <p class="ls-desc">{displayDesc}</p>
    {/if}

    <!-- Actions -->
    <div class="ls-actions">
      <button class="ls-btn ls-btn-primary" onclick={flyToMarker}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Hinzoomen
      </button>
      <button class="ls-btn" onclick={openInMaps}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8" cy="6" r="1.5" fill="currentColor"/>
        </svg>
        In Maps öffnen
      </button>
      <button class="ls-btn {showQr ? 'ls-btn-primary' : ''}" onclick={toggleQr}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
          <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
          <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
          <rect x="3" y="3" width="1" height="1" fill="currentColor"/>
          <rect x="12" y="3" width="1" height="1" fill="currentColor"/>
          <rect x="3" y="12" width="1" height="1" fill="currentColor"/>
          <path d="M10 10h2v2h-2zM12 12h3M12 10h3v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        QR-Code
      </button>
    </div>

    <!-- QR Display -->
    {#if showQr && qrChunks.length > 0}
      <div style="padding:0.75rem;border-top:1px solid var(--bd2);display:flex;flex-direction:column;align-items:center;gap:0.5rem">
        <span style="font-family:var(--fh);font-size:10px;font-weight:700;color:var(--td);text-transform:uppercase;letter-spacing:0.5px">
          QR-Code — {displayName}
        </span>
        <QRDisplay chunks={qrChunks} size={200} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .ls-backdrop {
    position: fixed;
    inset: 0;
    z-index: 490;
    background: rgba(0,0,0,0.35);
  }

  .loc-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 500;
    background: var(--s1);
    border-radius: 18px 18px 0 0;
    border-top: 1px solid var(--bd2);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
    transform: translateY(100%);
    transition: transform 0.32s cubic-bezier(.32,.72,0,1);
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }
  .loc-sheet.open {
    transform: translateY(0);
  }

  .ls-handle-row {
    display: flex;
    justify-content: center;
    padding: 0.55rem 0 0;
  }
  .ls-handle {
    width: 2.5rem;
    height: 4px;
    background: var(--bd2);
    border-radius: 2px;
  }

  .ls-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1rem 0.4rem;
  }
  .ls-emoji {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
    opacity: 0.9;
  }
  .ls-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ls-name {
    font-family: var(--fh);
    font-size: 15px;
    font-weight: 700;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ls-cat {
    font-family: var(--fh);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .ls-close {
    background: none;
    border: none;
    color: var(--td);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .ls-close:hover { color: var(--tx); }

  .ls-desc {
    margin: 0 1rem 0.5rem;
    font-size: 13px;
    color: var(--td);
    line-height: 1.4;
  }

  .ls-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0.75rem;
  }
  .ls-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 0.6rem 0.4rem;
    background: var(--s2);
    border: 1px solid var(--bd2);
    border-radius: 12px;
    color: var(--tx);
    font-family: var(--fh);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .ls-btn:active { transform: scale(0.94); }
  .ls-btn:hover { background: var(--s3); }
  .ls-btn-primary {
    background: var(--ac);
    border-color: var(--ac);
    color: #000;
  }
  .ls-btn-primary:hover { opacity: 0.9; background: var(--ac); }
</style>
