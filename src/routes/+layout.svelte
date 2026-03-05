<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { app } from '$lib/stores/app.svelte';
  import { a11yStore } from '$lib/stores/a11y.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import { navigationStore } from '$lib/stores/navigation.svelte';
  import { projectsStore } from '$lib/stores/projects.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import { recordingStore } from '$lib/stores/recording.svelte';
  import { onSwBroadcast } from '$lib/services/sw-messenger';
  import Toast from '$lib/components/ui/Toast.svelte';

  interface Props {
    children: import('svelte').Snippet;
  }
  let { children }: Props = $props();

  // ── Map Rendering Effects ─────────────────────────────────────────────────
  // Placed in root layout so they survive HMR and react to async store inits.

  // Track rendering + category filter
  $effect(() => {
    const map    = mapStore.map;
    const tracks = tracksStore.tracks;
    const filter = mapStore.filter;
    if (!map) return;
    for (const t of tracks) {
      const show = filter === 'all' || t.cat === filter;
      if (show && t.visible) {
        if (!tracksStore.hasLayer(t.id)) void tracksStore.renderTrackOnMap(t);
      } else {
        if (tracksStore.hasLayer(t.id)) tracksStore.removeTrackFromMap(t);
      }
    }
  });

  // LOCS markers + category filter + scale
  $effect(() => {
    const map    = mapStore.map;
    const filter = mapStore.filter;
    const _scale = markersStore.markerScale;
    void _scale;
    if (!map) return;
    void markersStore.renderLocsOnMap(filter);
  });

  onMount(() => {
    // Initialize all stores in dependency order (async, fire-and-forget)
    void (async () => {
      app.init();
      a11yStore.init();
      await projectsStore.init();
      await tracksStore.init();
      await markersStore.init();
      recordingStore.init();

      // SW broadcast handler (update prompts etc.)
      onSwBroadcast((msg) => {
        if (msg.type === 'SKIP_WAITING') {
          app.setSwUpdateAvailable(true);
        }
      });

      // Auto-download GMTW tracks from GitHub (non-blocking, only if none loaded yet)
      setTimeout(async () => {
        if (tracksStore.tracks.length === 0) {
          await tracksStore.autoDownloadTracks(false);
        }
      }, 1500);
    })();

    // ── Keyboard Shortcuts ──────────────────────────────────────────────────
    // V = Kartenübersicht (fitAll)
    // N = Nächster Punkt (TTS)
    // S = Einstellungen öffnen
    // G = GPS umschalten
    // Esc = Einstellungen/Modal schließen
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          tracksStore.fitAllTracks();
          a11yStore.speak('Kartenübersicht');
          break;
        case 'n':
          e.preventDefault();
          a11yStore.speakNearestPoint();
          break;
        case 's':
          e.preventDefault();
          if (app.settingsOpen) app.closeSettings();
          else app.openSettings();
          break;
        case 'g':
          e.preventDefault();
          mapStore.toggleGps();
          break;
        case 'escape':
          e.preventDefault();
          if (app.settingsOpen) app.closeSettings();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

{@render children()}
<Toast />
