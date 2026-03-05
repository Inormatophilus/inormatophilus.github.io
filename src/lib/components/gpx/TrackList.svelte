<script lang="ts">
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import TrackCard from './TrackCard.svelte';

  let expandedId = $state<string | null>(null);
</script>

<div style="display:flex;flex-direction:column;gap:0.4rem;padding:0.5rem 0">
  {#if tracksStore.activeProjectTracks.length === 0}
    <div style="text-align:center;padding:2rem;color:var(--td)">
      <div style="font-size:2rem;margin-bottom:0.5rem">🗺</div>
      <p>Noch keine Tracks im aktiven Projekt.</p>
      <p class="text-sm" style="margin-top:0.3rem">GPX-Datei über FAB importieren.</p>
    </div>
  {:else}
    {#each tracksStore.activeProjectTracks as track}
      <TrackCard
        {track}
        expanded={expandedId === track.id}
        ontoggle={() => expandedId = expandedId === track.id ? null : track.id}
      />
    {/each}
  {/if}
</div>
