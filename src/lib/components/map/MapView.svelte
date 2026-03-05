<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import { projectsStore } from '$lib/stores/projects.svelte';
  import GpsMarker from './GpsMarker.svelte';

  let container: HTMLDivElement;

  onMount(async () => {
    await mapStore.init(container);
    // Render custom markers once map is ready
    // (tracks and locs are handled reactively in +layout.svelte)
    await markersStore.renderAllCustomOnMap();
  });

  onDestroy(() => {
    mapStore.destroy();
  });

  // Project dblclick mode
  $effect(() => {
    if (!mapStore.map || !projectsStore.createMode) return;
    const map = mapStore.map;
    map.getContainer().style.cursor = 'crosshair';

    function onDblClick(e: import('leaflet').LeafletMouseEvent) {
      const zoom = map.getZoom();
      projectsStore.openStep2(e.latlng.lat, e.latlng.lng, zoom);
      map.getContainer().style.cursor = '';
    }
    map.once('dblclick', onDblClick);
    return () => {
      map.off('dblclick', onDblClick);
      map.getContainer().style.cursor = '';
    };
  });
</script>

<div bind:this={container} class="map-container">
  {#if mapStore.map}
    <GpsMarker />
  {/if}

  <!-- Project create mode hint -->
  {#if projectsStore.createMode}
    <div class="proj-create-hint">🗺 Doppelklick auf Karte für neues Projekt</div>
  {/if}
</div>

<style>
  .map-container {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
</style>
