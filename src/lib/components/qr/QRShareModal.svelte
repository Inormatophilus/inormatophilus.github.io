<script lang="ts">
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import { projectsStore } from '$lib/stores/projects.svelte';
  import { exportFullBackup } from '$lib/services/storage';
  import { encodeTrackToChunks, encodeObjectToChunks, encodeMarkerQr } from '$lib/services/qr-engine';
  import { app } from '$lib/stores/app.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import QRDisplay from './QRDisplay.svelte';
  import QRScanner from './QRScanner.svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
  }
  let { open = $bindable(), onclose }: Props = $props();

  type Mode = 'select' | 'qr' | 'scan';
  let mode    = $state<Mode>('select');
  let chunks  = $state<string[]>([]);
  let loading = $state(false);

  async function encodeTrack(id: string) {
    loading = true;
    try {
      const track = tracksStore.getTrack(id);
      if (!track) return;
      const gpx = await tracksStore.getGpxWithFeatures(id) ?? track.gpxString;
      chunks = encodeTrackToChunks(track, gpx);
      mode   = 'qr';
    } catch (e) {
      app.toast(`Fehler: ${e}`, 'error');
    } finally {
      loading = false;
    }
  }

  async function encodeBackup() {
    loading = true;
    try {
      const backup = await exportFullBackup();
      chunks = encodeObjectToChunks(backup, 'backup');
      mode   = 'qr';
    } catch (e) {
      app.toast(`Fehler: ${e}`, 'error');
    } finally {
      loading = false;
    }
  }

  async function encodeProject(id: string) {
    loading = true;
    try {
      const { exportProjectJson } = await import('$lib/services/storage');
      const json = await exportProjectJson(id);
      chunks = encodeObjectToChunks(JSON.parse(json), 'project');
      mode   = 'qr';
    } catch (e) {
      app.toast(`Fehler: ${e}`, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<BottomSheet
  {open}
  title="QR-Code"
  onclose={() => { mode = 'select'; onclose?.(); }}
  maxHeight="90vh"
>
  {#if mode === 'select'}
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      <!-- Track selection -->
      {#if tracksStore.activeProjectTracks.length > 0}
        <div class="card">
          <div class="form-label mb-2">Track als QR</div>
          {#each tracksStore.activeProjectTracks as track}
            <button
              style="width:100%;display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border:none;background:none;cursor:pointer;color:var(--tx);text-align:left;border-bottom:1px solid var(--bd)"
              onclick={() => encodeTrack(track.id)}
              disabled={loading}
            >
              <span>🗺</span>
              <span class="flex-1 truncate text-sm">{track.name}</span>
              <span class="text-xs text-dim">{track.stats.distKm.toFixed(1)} km</span>
              <span style="color:var(--ac)">▶</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Projekt QR -->
      {#if projectsStore.activeProject}
        <button class="btn btn-secondary w-full" onclick={() => encodeProject(projectsStore.activeProjectId!)} disabled={loading}>
          🗂 Aktives Projekt als QR
        </button>
      {/if}

      <!-- Backup QR -->
      <button class="btn btn-secondary w-full" onclick={encodeBackup} disabled={loading}>
        {loading ? '⏳ Generiere…' : '💾 Vollständiges Backup als QR'}
      </button>

      <!-- QR Scanner -->
      <button class="btn btn-primary w-full" onclick={() => mode = 'scan'}>
        📷 QR-Code scannen
      </button>
    </div>

  {:else if mode === 'qr'}
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
      <QRDisplay {chunks} size={260} fps={3} />
      <p class="text-sm text-dim text-center">
        {chunks.length > 1
          ? `${chunks.length} QR-Codes — Mit anderem Gerät nacheinander scannen`
          : 'Einzel-QR — Scannen mit GMTW-App'}
      </p>
      <button class="btn btn-secondary" onclick={() => mode = 'select'}>← Zurück</button>
    </div>

  {:else if mode === 'scan'}
    <QRScanner onstop={() => { mode = 'select'; onclose?.(); }} />
  {/if}
</BottomSheet>
