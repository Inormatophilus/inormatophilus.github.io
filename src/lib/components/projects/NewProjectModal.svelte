<script lang="ts">
  import { projectsStore } from '$lib/stores/projects.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';

  let name     = $state('');
  let creating = $state(false);

  const coords = $derived(projectsStore.step2Coords);
  const subtitle = $derived(
    coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} — Zoom ${coords.zoom}` : ''
  );

  async function create(action: 'only' | 'marker' | 'gpx' | 'import') {
    if (!coords || !name.trim()) return;
    creating = true;
    try {
      const proj = await projectsStore.createProject(name.trim(), coords.lat, coords.lng, coords.zoom);
      projectsStore.closeStep2();

      if (action === 'marker') {
        // TODO: open marker modal for new project
        app.toast('Projekt erstellt — Marker-Modus', 'info');
      } else if (action === 'gpx') {
        // Trigger GPX import
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.gpx';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const text = await file.text();
          await tracksStore.loadGpxString(text, file.name.replace(/\.gpx$/i, ''), 'custom', proj.id);
        };
        input.click();
      } else if (action === 'import') {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const json = await file.text();
          await projectsStore.importProjectFromJson(json);
        };
        input.click();
      }
    } finally {
      creating = false;
      name = '';
    }
  }

</script>

<BottomSheet
  open={projectsStore.step2Open}
  title="Neues Projekt"
  {subtitle}
  onclose={() => projectsStore.cancelCreateMode()}
>
  <div style="display:flex;flex-direction:column;gap:0.75rem">
    <div class="form-row">
      <label class="form-label" for="proj-name">Projektname</label>
      <input
        id="proj-name"
        class="input"
        type="text"
        bind:value={name}
        placeholder="z.B. GMTW 2026"
        autofocus
      />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
      <button class="btn btn-secondary" onclick={() => create('only')} disabled={!name.trim() || creating}>
        ✓ Nur erstellen
      </button>
      <button class="btn btn-secondary" onclick={() => create('marker')} disabled={!name.trim() || creating}>
        📍 + Marker
      </button>
      <button class="btn btn-secondary" onclick={() => create('gpx')} disabled={!name.trim() || creating}>
        🗺 + GPX
      </button>
      <button class="btn btn-secondary" onclick={() => create('import')} disabled={!name.trim() || creating}>
        📂 + Import
      </button>
    </div>

    <button class="btn btn-ghost" onclick={() => projectsStore.cancelCreateMode()}>
      Abbrechen
    </button>
  </div>
</BottomSheet>
