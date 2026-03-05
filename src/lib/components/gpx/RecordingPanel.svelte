<script lang="ts">
  import { recordingStore } from '$lib/stores/recording.svelte';
  import { app } from '$lib/stores/app.svelte';

  let nameInput = $state('');

  function startRec() {
    recordingStore.name = nameInput || `Track ${new Date().toLocaleDateString('de')}`;
    recordingStore.start();
  }

  async function stopAndSave() {
    await recordingStore.stop(true);
  }

  function discard() {
    if (confirm('Aufnahme verwerfen?')) recordingStore.discard();
  }
</script>

<div style="display:flex;flex-direction:column;gap:0.75rem;padding:0.5rem 0">
  {#if !recordingStore.active}
    <!-- Start form -->
    <div class="card">
      <div class="form-row">
        <label class="form-label" for="rec-name">Track-Name</label>
        <input id="rec-name" class="input" type="text" bind:value={nameInput}
          placeholder="Track {new Date().toLocaleDateString('de')}" />
      </div>
      <button class="btn btn-primary w-full" onclick={startRec}>
        🔴 Aufnahme starten
      </button>
    </div>
  {:else}
    <!-- Live recording stats -->
    <div class="card" style="border-color:var(--ac)">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
        <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;animation:gps-pulse 1s infinite"></div>
        <span class="font-head" style="color:var(--ac)">REC — {recordingStore.name}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;margin-bottom:0.75rem">
        <div>
          <div class="text-xs text-dim">Zeit</div>
          <div class="font-head">{recordingStore.elapsedFormatted}</div>
        </div>
        <div>
          <div class="text-xs text-dim">Distanz</div>
          <div class="font-head">{recordingStore.distFormatted}</div>
        </div>
        <div>
          <div class="text-xs text-dim">Punkte</div>
          <div class="font-head">{recordingStore.pointCount}</div>
        </div>
      </div>

      {#if recordingStore.topSpeedKmh > 0}
        <div class="text-sm text-dim" style="margin-bottom:0.5rem">
          Max. Speed: {recordingStore.topSpeedKmh.toFixed(1)} km/h
        </div>
      {/if}

      <div style="display:flex;gap:0.5rem">
        <button
          class="btn {recordingStore.paused ? 'btn-primary' : 'btn-secondary'} flex-1"
          onclick={() => recordingStore.togglePause()}
        >
          {recordingStore.paused ? '▶ Weiter' : '⏸ Pause'}
        </button>
        <button class="btn btn-primary flex-1" onclick={stopAndSave}>
          ⏹ Speichern
        </button>
        <button class="btn btn-ghost" onclick={discard} title="Verwerfen">🗑</button>
      </div>
    </div>
  {/if}
</div>
