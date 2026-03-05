<script lang="ts">
  import { a11yStore } from '$lib/stores/a11y.svelte';
  import { app } from '$lib/stores/app.svelte';
</script>

{#if a11yStore.enabled}
  <div class="a11y-fab" style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end">
    <button
      class="fab {a11yStore.ttsActive ? 'active' : ''}"
      onclick={() => a11yStore.toggleSpeaking()}
      title={a11yStore.ttsActive ? app.t('tts_pause') : app.t('tts_speak')}
      aria-label={a11yStore.ttsActive ? app.t('tts_pause') : app.t('tts_speak')}
    >
      {a11yStore.ttsActive ? '⏸' : '🔊'}
    </button>

    {#if a11yStore.ttsActive}
      <button
        class="fab btn-secondary"
        style="font-size:0.9rem"
        onclick={() => a11yStore.stop()}
        title={app.t('tts_stop')}
      >⏹</button>
    {/if}

    <button
      class="fab"
      style="font-size:0.85rem;width:2.5rem;height:2.5rem"
      onclick={() => a11yStore.speakMapOverview()}
      title={app.t('map_overview')}
    >🗺</button>

    <button
      class="fab"
      style="font-size:0.85rem;width:2.5rem;height:2.5rem"
      onclick={() => a11yStore.speakNearestPoint()}
      title={app.t('nearest_point')}
    >📍</button>
  </div>
{/if}

<style>
  .a11y-fab {
    position: fixed;
    bottom: 5.5rem;
    right: 0.75rem;
    z-index: 500;
  }
</style>
