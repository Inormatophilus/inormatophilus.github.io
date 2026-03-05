<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { FEAT_ICONS, FEAT_NAMES } from '$lib/types';
  import type { FeatureType, TrackFeature } from '$lib/types';

  interface Props {
    trackId: string;
    onclose?: () => void;
    onsave?: (feat: TrackFeature) => void;
  }
  let { trackId, onclose, onsave }: Props = $props();

  let miniMap: HTMLDivElement;
  let lMap: import('leaflet').Map | null = null;
  let crosshairLat = $state(mapStore.gpsPos?.lat ?? 51.4192);
  let crosshairLng = $state(mapStore.gpsPos?.lng ?? 7.4855);

  let selType  = $state<FeatureType>('drop');
  let featName = $state('');
  let featDiff = $state(3);

  const FEAT_TYPES = Object.keys(FEAT_ICONS) as FeatureType[];

  onMount(async () => {
    const L = await import('leaflet');
    lMap = L.map(miniMap, {
      center: [crosshairLat, crosshairLng],
      zoom:   mapStore.map?.getZoom() ?? 16,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(lMap);
    lMap.on('moveend', () => {
      const c = lMap!.getCenter();
      crosshairLat = c.lat;
      crosshairLng = c.lng;
    });
  });

  onDestroy(() => {
    lMap?.remove();
  });

  function save() {
    const feat: TrackFeature = {
      type: selType,
      name: featName || FEAT_NAMES[selType],
      diff: featDiff,
      date: Date.now(),
      lat:  crosshairLat,
      lng:  crosshairLng,
    };
    onsave?.(feat);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:450;display:flex;flex-direction:column" role="dialog">
  <!-- Mini map -->
  <div style="flex:1;position:relative">
    <div bind:this={miniMap} style="width:100%;height:100%"></div>
    <!-- Crosshair -->
    <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
      <div style="font-size:2rem;filter:drop-shadow(0 0 4px #000)">{FEAT_ICONS[selType]}</div>
    </div>
    <div style="position:absolute;top:0.5rem;left:50%;transform:translateX(-50%);background:rgba(11,14,20,0.85);padding:0.25rem 0.75rem;border-radius:1rem;font-size:0.75rem;color:var(--td)">
      {crosshairLat.toFixed(5)}, {crosshairLng.toFixed(5)}
    </div>
  </div>

  <!-- Controls -->
  <div style="background:var(--s1);padding:1rem;display:flex;flex-direction:column;gap:0.5rem">
    <!-- Type selector -->
    <div style="display:flex;gap:0.3rem;overflow-x:auto;scrollbar-width:none">
      {#each FEAT_TYPES as type}
        <button
          class="chip {selType === type ? 'active' : ''}"
          onclick={() => selType = type}
          style="flex-shrink:0"
          title={FEAT_NAMES[type]}
        >
          {FEAT_ICONS[type]}
        </button>
      {/each}
    </div>

    <div class="form-row">
      <label class="form-label" for="feat-name">Name</label>
      <input id="feat-name" class="input" type="text" bind:value={featName}
        placeholder={FEAT_NAMES[selType]} />
    </div>

    <div class="form-row">
      <label class="form-label">Schwierigkeit</label>
      <div class="stars">
        {#each [1,2,3,4,5] as s}
          <button class="star {s <= featDiff ? 'filled' : ''}" onclick={() => featDiff = s}>★</button>
        {/each}
      </div>
    </div>

    <div style="display:flex;gap:0.5rem">
      <button class="btn btn-secondary flex-1" onclick={onclose}>Abbrechen</button>
      <button class="btn btn-primary flex-1" onclick={save}>Feature setzen</button>
    </div>
  </div>
</div>
