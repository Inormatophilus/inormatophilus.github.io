<script lang="ts">
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { parseGpx } from '$lib/services/gpx';

  interface Props { trackId: string }
  let { trackId }: Props = $props();

  const W = 300, H = 70, PAD = 4;

  const path = $derived.by(() => {
    const track = tracksStore.getTrack(trackId);
    if (!track) return '';
    const pts = parseGpx(track.gpxString).points.filter(p => p.ele !== undefined);
    if (pts.length < 2) return '';

    const eles = pts.map(p => p.ele!);
    const minE = Math.min(...eles);
    const maxE = Math.max(...eles);
    const range = maxE - minE || 1;

    const points = pts.map((p, i) => {
      const x = PAD + ((i / (pts.length - 1)) * (W - PAD * 2));
      const y = H - PAD - ((p.ele! - minE) / range) * (H - PAD * 2);
      return `${x},${y}`;
    });

    return `M${points.join('L')}`;
  });

  const filled = $derived(path ? path + `L${W - PAD},${H - PAD} L${PAD},${H - PAD}Z` : '');
</script>

{#if path}
  <svg viewBox="0 0 {W} {H}" class="elevation-svg" role="img" aria-label="Höhenprofil">
    <defs>
      <linearGradient id="elev-fill-{trackId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--ac)" stop-opacity="0.35" />
        <stop offset="100%" stop-color="var(--ac)" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    <path d={filled} fill="url(#elev-fill-{trackId})" />
    <path d={path} fill="none" stroke="var(--ac)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{/if}
