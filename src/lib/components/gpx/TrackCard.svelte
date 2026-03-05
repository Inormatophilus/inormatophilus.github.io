<script lang="ts">
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { raceEngine } from '$lib/stores/race.svelte';
  import { navigationStore } from '$lib/stores/navigation.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { CAT_COLORS, CAT_EMOJIS } from '$lib/types';
  import ElevationProfile from './ElevationProfile.svelte';
  import type { GmtwTrack } from '$lib/types';

  interface Props {
    track: GmtwTrack;
    expanded: boolean;
    ontoggle?: () => void;
  }
  let { track, expanded, ontoggle }: Props = $props();

  const rating     = $derived(tracksStore.getRating(track.id));
  const features   = $derived(tracksStore.getFeatures(track.id));

  function fitTrack() {
    if (!track.bounds) return;
    mapStore.fitBounds([
      [track.bounds.south, track.bounds.west],
      [track.bounds.north, track.bounds.east]
    ]);
  }

  async function shareGpx() {
    const gpx = await tracksStore.getGpxWithFeatures(track.id);
    if (!gpx) return;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    if (navigator.share) {
      navigator.share({
        title: track.name,
        files: [new File([blob], track.name + '.gpx', { type: 'application/gpx+xml' })]
      }).catch(() => {
        downloadGpx(gpx, track.name);
      });
    } else {
      downloadGpx(gpx, track.name);
    }
  }

  function downloadGpx(gpx: string, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
    a.download = name + '.gpx';
    a.click();
  }
</script>

<div
  class="card"
  style="border-left:4px solid {CAT_COLORS[track.cat] ?? '#a855f7'};padding:0.6rem 0.75rem"
>
  <!-- Header Row -->
  <button
    onclick={ontoggle}
    style="width:100%;display:flex;align-items:center;gap:0.5rem;background:none;border:none;cursor:pointer;color:var(--tx);text-align:left"
    aria-expanded={expanded}
  >
    <label class="toggle" style="flex-shrink:0" onclick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={track.visible}
        onchange={() => tracksStore.toggleTrack(track.id)} />
      <span class="toggle-slider"></span>
    </label>
    <span style="font-size:1rem;flex-shrink:0">{CAT_EMOJIS[track.cat] ?? '🟣'}</span>
    <span class="truncate font-head" style="flex:1;font-size:0.9rem">{track.name}</span>
    <span class="text-dim" style="font-size:0.75rem">{track.stats.distKm.toFixed(1)} km</span>
    <span class="text-dim" style="font-size:0.8rem">{expanded ? '▲' : '▼'}</span>
  </button>

  <!-- Expanded Details -->
  {#if expanded}
    <div style="margin-top:0.5rem;border-top:1px solid var(--bd);padding-top:0.5rem">
      <!-- Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.25rem;margin-bottom:0.5rem">
        <div style="text-align:center">
          <div class="text-xs text-dim">Distanz</div>
          <div class="text-sm font-head">{track.stats.distKm.toFixed(1)} km</div>
        </div>
        <div style="text-align:center">
          <div class="text-xs text-dim">Anstieg</div>
          <div class="text-sm font-head">↑{track.stats.elevGain.toFixed(0)} m</div>
        </div>
        <div style="text-align:center">
          <div class="text-xs text-dim">Abstieg</div>
          <div class="text-sm font-head">↓{track.stats.elevLoss.toFixed(0)} m</div>
        </div>
      </div>

      <!-- Elevation Profile -->
      <ElevationProfile trackId={track.id} />

      <!-- Stars Rating -->
      <div style="display:flex;align-items:center;gap:0.3rem;margin:0.5rem 0">
        <span class="text-xs text-dim">Bewertung:</span>
        <div class="stars">
          {#each [1, 2, 3, 4, 5] as star}
            <button
              class="star {star <= rating ? 'filled' : ''}"
              onclick={() => tracksStore.setRating(track.id, star)}
              aria-label="{star} Sterne"
            >★</button>
          {/each}
        </div>
      </div>

      <!-- Features count -->
      {#if features.length > 0}
        <div class="text-xs text-dim" style="margin-bottom:0.4rem">
          {features.length} Feature(s) gesetzt
        </div>
      {/if}

      <!-- Actions -->
      <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick={fitTrack}>📍 Anzeigen</button>
        <button class="btn btn-secondary btn-sm" onclick={shareGpx}>📤 Teilen</button>
        <button class="btn btn-secondary btn-sm"
          onclick={async () => { await raceEngine.setup(track.id); app.toast('Race-Modus aktiv', 'info'); }}>
          🏁 Race
        </button>
        <button class="btn btn-secondary btn-sm"
          onclick={() => navigationStore.toggle(track.id)}>
          {navigationStore.active && navigationStore.trackId === track.id ? '🧭 Stop Nav' : '🧭 Nav'}
        </button>
        <button class="btn btn-ghost btn-sm" style="color:#ef4444"
          onclick={() => { if (confirm(`"${track.name}" löschen?`)) tracksStore.removeTrack(track.id); }}>
          🗑
        </button>
      </div>
    </div>
  {/if}
</div>
