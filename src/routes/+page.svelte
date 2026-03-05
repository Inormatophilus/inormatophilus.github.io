<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import { raceEngine } from '$lib/stores/race.svelte';
  import { navigationStore } from '$lib/stores/navigation.svelte';

  // Map
  import MapView from '$lib/components/map/MapView.svelte';
  import TopBar from '$lib/components/map/TopBar.svelte';
  import FilterChips from '$lib/components/map/FilterChips.svelte';
  import MapFABs from '$lib/components/map/MapFABs.svelte';

  // Settings
  import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';

  // GPX Panel
  import GpxPanel from '$lib/components/gpx/GpxPanel.svelte';
  import TrackSheet from '$lib/components/gpx/TrackSheet.svelte';

  // Race
  import RaceHUD from '$lib/components/race/RaceHUD.svelte';

  // Navigation
  import NavHUD from '$lib/components/navigation/NavHUD.svelte';

  // QR
  import QRShareModal from '$lib/components/qr/QRShareModal.svelte';

  // Projects
  import NewProjectModal from '$lib/components/projects/NewProjectModal.svelte';
  import { projectsStore } from '$lib/stores/projects.svelte';

  // Markers
  import MarkerModal from '$lib/components/markers/MarkerModal.svelte';
  import LocSheet from '$lib/components/markers/LocSheet.svelte';

  // UI
  import A11yFab from '$lib/components/ui/A11yFab.svelte';
  import PwaInstallBanner from '$lib/components/ui/PwaInstallBanner.svelte';

  // Panel state
  let gpxPanelOpen    = $state(false);
  let qrModalOpen     = $state(false);
  let markerModalOpen = $state(false);
  let markerLat       = $state(0);
  let markerLng       = $state(0);

  function toggleSheet() {
    gpxPanelOpen = !gpxPanelOpen;
    if (gpxPanelOpen) tracksStore.clearSelection();
  }

  function fitAll() {
    tracksStore.fitAllTracks();
  }

  function openMarkerModal() {
    if (!mapStore.map) return;
    const c  = mapStore.map.getCenter();
    markerLat = c.lat;
    markerLng = c.lng;
    markerModalOpen = true;
  }

  // ── GPS → Race + Navigation Wiring ──────────────────────────────────────
  $effect(() => {
    const pos = mapStore.gpsPos;
    if (!pos) return;
    const ts  = Date.now();
    const acc = mapStore.gpsAccuracy;

    if (raceEngine.state !== 'idle' && raceEngine.state !== 'finished') {
      raceEngine.processPosition(pos.lat, pos.lng, ts, acc);
    }
    if (navigationStore.active) {
      navigationStore.processPosition(pos.lat, pos.lng);
    }
  });

  // Map double-click → custom marker (skip when in project-create mode)
  $effect(() => {
    if (!mapStore.map) return;
    const map = mapStore.map;
    function onDblClick(e: import('leaflet').LeafletMouseEvent) {
      if (projectsStore.createMode) return;
      markerLat = e.latlng.lat;
      markerLng = e.latlng.lng;
      markerModalOpen = true;
    }
    map.on('dblclick', onDblClick);
    return () => map.off('dblclick', onDblClick);
  });
</script>

<svelte:head>
  <title>GMTW Trail Map</title>
</svelte:head>

<div style="position:fixed;inset:0;overflow:hidden">
  <!-- Map (full screen) -->
  <MapView />

  <!-- Top Bar -->
  <TopBar onToggleSheet={toggleSheet} />

  <!-- Filter Chips -->
  <FilterChips />

  <!-- FABs (right column — includes 📍 marker button) -->
  <MapFABs
    onOpenGpx={() => gpxPanelOpen = true}
    onOpenQr={() => qrModalOpen = true}
    onFitAll={fitAll}
    onOpenMarker={openMarkerModal}
  />

  <!-- Navigation HUD -->
  <NavHUD />

  <!-- Race HUD (overlay) -->
  <RaceHUD />

  <!-- Track Info Sheet -->
  <TrackSheet />

  <!-- LOCS Marker Info Sheet -->
  <LocSheet />

  <!-- GPX Panel -->
  <GpxPanel bind:open={gpxPanelOpen} onclose={() => gpxPanelOpen = false} />

  <!-- Settings Panel -->
  <SettingsPanel />

  <!-- QR Share Modal -->
  <QRShareModal bind:open={qrModalOpen} onclose={() => qrModalOpen = false} />

  <!-- New Project Modal -->
  <NewProjectModal />

  <!-- Custom Marker Modal (new marker) -->
  {#if markerModalOpen}
    <MarkerModal
      bind:open={markerModalOpen}
      lat={markerLat}
      lng={markerLng}
      onclose={() => markerModalOpen = false}
    />
  {/if}

  <!-- Custom Marker Detail/Edit (click on map marker → opens with QR option) -->
  {#if markersStore.selectedCustomMarker}
    <MarkerModal
      open={true}
      marker={markersStore.selectedCustomMarker}
      onclose={() => markersStore.clearCustomSelection()}
    />
  {/if}

  <!-- A11Y FAB -->
  <A11yFab />

  <!-- PWA Install Banner -->
  <PwaInstallBanner />
</div>
