<script lang="ts">
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { FEAT_ICONS, FEAT_NAMES } from '$lib/types';
  import FeatPosPickerModal from './FeatPosPickerModal.svelte';
  import type { FeatureType, GmtwTrack } from '$lib/types';

  interface Props {
    track: GmtwTrack;
  }
  let { track }: Props = $props();

  const features = $derived(tracksStore.getFeatures(track.id));
  let addingFeature = $state(false);
  let editingType = $state<FeatureType>('drop');

  const FEAT_TYPES = Object.keys(FEAT_ICONS) as FeatureType[];
</script>

<div style="display:flex;flex-direction:column;gap:0.5rem">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div class="form-label">Features ({features.length})</div>
    <button class="btn btn-secondary btn-sm" onclick={() => addingFeature = true}>+ Feature</button>
  </div>

  {#each features as feat, i}
    <div class="card card-sm" style="display:flex;align-items:center;gap:0.5rem">
      <span style="font-size:1.2rem">{FEAT_ICONS[feat.type]}</span>
      <div style="flex:1">
        <div class="text-sm font-head">{feat.name || FEAT_NAMES[feat.type]}</div>
        <div class="text-xs text-dim">
          {'★'.repeat(feat.diff)}{'☆'.repeat(5 - feat.diff)} · {feat.lat.toFixed(4)}, {feat.lng.toFixed(4)}
        </div>
      </div>
      <button class="btn-icon" style="width:1.8rem;height:1.8rem;font-size:0.7rem;color:#ef4444"
        onclick={() => { if (confirm('Feature löschen?')) tracksStore.removeFeature(track.id, i); }}>🗑</button>
    </div>
  {/each}

  {#if features.length === 0}
    <p class="text-sm text-dim">Noch keine Features. Füge Punkte hinzu um Streckenabschnitte zu markieren.</p>
  {/if}
</div>

{#if addingFeature}
  <FeatPosPickerModal
    trackId={track.id}
    onclose={() => addingFeature = false}
    onsave={(feat) => {
      tracksStore.addFeature(track.id, feat);
      addingFeature = false;
      // Re-render feature markers on map
      tracksStore.renderFeatureMarkersOnMap(track);
    }}
  />
{/if}
