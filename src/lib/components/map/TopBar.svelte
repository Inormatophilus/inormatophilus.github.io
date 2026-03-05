<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';

  interface Props {
    onToggleSheet: () => void;
  }
  let { onToggleSheet }: Props = $props();

  const trackCount = $derived(tracksStore.tracks.length);
</script>

<div class="topbar">
  <!-- Left: Burger menu button -->
  <button
    class="ibtn"
    id="burger-btn"
    onclick={onToggleSheet}
    aria-label="Menü öffnen"
    title="Streckenliste"
  >
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <path d="M0 1H18M0 7H12M0 13H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    {#if trackCount > 0}
      <span class="burger-badge">{trackCount}</span>
    {/if}
  </button>

  <!-- Center: Title pill -->
  <div id="titlepill">
    <div class="logobadge">MUNI</div>
    <div>
      <div class="ttl">GMTW Trail Map</div>
      <div class="tsub">Hohensyburg · Herdecke</div>
    </div>
  </div>

  <!-- Right: Layer toggle -->
  <button
    class="ibtn"
    id="layer-btn"
    onclick={() => mapStore.toggleLayer()}
    aria-label={mapStore.layer === 'topo' ? 'Satellitenbild' : 'Topokarte'}
    title={mapStore.layer === 'topo' ? 'Satellitenbild' : 'Topokarte'}
  >
    {#if mapStore.layer === 'topo'}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L17 5.5L9 10L1 5.5L9 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M1 9.5L9 14L17 9.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M2 9h14M9 2a11 11 0 010 14M9 2a11 11 0 000 14" stroke="currentColor" stroke-width="1.2" opacity=".6"/>
      </svg>
    {/if}
  </button>
</div>

<style>
  .topbar {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: linear-gradient(to bottom, rgba(var(--bg-rgb,11,14,20), 0.96) 70%, transparent);
    pointer-events: none;
  }
  .topbar > * { pointer-events: auto; }

  .ibtn {
    background: var(--s2);
    border: 1px solid var(--bd2);
    border-radius: 10px;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--tx);
    flex-shrink: 0;
    position: relative;
    transition: background 0.15s;
  }
  .ibtn:active { transform: scale(0.93); }

  .burger-badge {
    position: absolute;
    top: -4px; right: -4px;
    background: var(--ac);
    color: #000;
    font-size: 9px;
    font-weight: 800;
    border-radius: 10px;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    font-family: var(--fh);
  }

  #titlepill {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--s2);
    border: 1px solid var(--bd2);
    border-radius: 12px;
    padding: 5px 10px 5px 8px;
    min-width: 0;
    overflow: hidden;
  }

  .logobadge {
    background: var(--ac);
    color: #000;
    font-family: var(--fh);
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.04em;
    border-radius: 6px;
    padding: 2px 6px;
    flex-shrink: 0;
  }

  .ttl {
    font-family: var(--fh);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tsub {
    font-family: var(--fh);
    font-size: 10px;
    color: var(--td);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
