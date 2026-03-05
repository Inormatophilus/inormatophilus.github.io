<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import Modal from '../../ui/Modal.svelte';
  import type { LocMarker } from '$lib/types';

  let editingLoc  = $state<LocMarker | null>(null);
  let editName    = $state('');
  let editEmoji   = $state('');
  let localScale  = $state(markersStore.markerScale);

  function openLocEdit(loc: LocMarker) {
    editingLoc = loc;
    editName   = loc._overrideName ?? '';
    editEmoji  = loc._overrideEmoji ?? '';
  }

  async function saveLoc() {
    if (!editingLoc) return;
    await markersStore.updateLocsMarker(editingLoc.id, editName || undefined, editEmoji || undefined);
    editingLoc = null;
    app.toast('Marker gespeichert', 'success');
  }
</script>

<div style="padding-top:0.75rem;display:flex;flex-direction:column;gap:0.75rem">

  <!-- Marker Scale -->
  <div class="card card-sm">
    <label class="form-label" for="mk-scale">
      Markergröße: {(localScale * 100).toFixed(0)}%
    </label>
    <input
      id="mk-scale"
      type="range" min="0.5" max="2" step="0.1"
      value={localScale}
      oninput={(e) => { localScale = parseFloat((e.target as HTMLInputElement).value); }}
      onchange={() => markersStore.setMarkerScale(localScale)}
    />
  </div>

  <!-- LOCS Markers -->
  <div class="card">
    <div class="form-label mb-2">LOCS-Marker ({markersStore.locs.length})</div>
    <div style="display:flex;flex-direction:column;gap:0.3rem">
      {#each markersStore.locs as loc}
        {@const name = loc._overrideName ?? (loc.nameI18n?.[app.lang] ?? loc.name)}
        {@const emoji = loc._overrideEmoji ?? loc.emoji}
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--bd)">
          <span>{emoji}</span>
          <span class="flex-1 truncate text-sm">{name}</span>
          <label class="toggle" style="width:2rem;height:1.2rem">
            <input type="checkbox"
              checked={!loc._hidden}
              onchange={() => markersStore.toggleLocsVisibility(loc.id)} />
            <span class="toggle-slider"></span>
          </label>
          <button class="btn-icon" style="width:2rem;height:2rem;font-size:0.75rem"
            onclick={() => openLocEdit(loc)}>✏</button>
          {#if loc._overrideName || loc._overrideEmoji}
            <button class="btn-icon" style="width:2rem;height:2rem;font-size:0.7rem;color:#f59e0b"
              onclick={() => markersStore.resetLocsMarker(loc.id)} title="Zurücksetzen">↩</button>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Custom Markers -->
  <div class="card">
    <div class="form-label mb-2">Eigene Marker ({markersStore.activeProjectCustom.length})</div>
    {#if markersStore.activeProjectCustom.length === 0}
      <p class="text-sm text-dim">Noch keine eigenen Marker. Auf der Karte 📍 drücken.</p>
    {:else}
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        {#each markersStore.activeProjectCustom as m}
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--bd)">
            <span>{m.emoji}</span>
            <span class="flex-1 truncate text-sm">{m.name}</span>
            <a href={m.gmapsUrl} target="_blank" rel="noopener" class="btn-icon" style="width:2rem;height:2rem;font-size:0.8rem;text-decoration:none">🗺</a>
            <button class="btn-icon" style="width:2rem;height:2rem;font-size:0.75rem;color:#ef4444"
              onclick={() => { if (confirm(`"${m.name}" löschen?`)) markersStore.deleteCustomMarker(m.id); }}>🗑</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- LOCS Edit Modal -->
{#if editingLoc}
  <Modal title="Marker bearbeiten" open={editingLoc !== null}
    onclose={() => editingLoc = null}>
    {#snippet footer()}
      <button class="btn btn-primary" onclick={saveLoc}>Speichern</button>
      <button class="btn btn-secondary" onclick={() => editingLoc = null}>Abbrechen</button>
    {/snippet}
    <div class="form-row">
      <label class="form-label">Name (leer = Standard)</label>
      <input class="input" type="text" bind:value={editName} placeholder="Standard verwenden" />
    </div>
    <div class="form-row">
      <label class="form-label">Emoji (leer = Standard)</label>
      <input class="input" type="text" bind:value={editEmoji} placeholder="Standard verwenden" maxlength="4" />
    </div>
  </Modal>
{/if}
