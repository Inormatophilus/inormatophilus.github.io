<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { recordingStore } from '$lib/stores/recording.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import TrackList from './TrackList.svelte';
  import RecordingPanel from './RecordingPanel.svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
  }
  let { open = $bindable(), onclose }: Props = $props();

  type TabId = 'tracks' | 'recording';
  let tab = $state<TabId>('tracks');

  // Switch to recording tab when recording starts
  $effect(() => {
    if (recordingStore.active) tab = 'recording';
  });
</script>

<!-- Backdrop -->
{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="settings-backdrop open"
    onclick={onclose}
    role="presentation"
  ></div>
{/if}

<div class="gpx-panel" class:open>
  <!-- Handle -->
  <div style="display:flex;justify-content:center;padding:0.5rem 0 0">
    <div style="width:2.5rem;height:4px;background:var(--bd2);border-radius:2px"></div>
  </div>

  <!-- Header -->
  <div class="panel-header">
    <div class="tabs" style="margin:0;flex:1">
      <button class="tab {tab === 'tracks' ? 'active' : ''}" onclick={() => tab = 'tracks'}>
        🗺 Tracks ({tracksStore.activeProjectTracks.length})
      </button>
      <button
        class="tab {tab === 'recording' ? 'active' : ''}"
        onclick={() => tab = 'recording'}
        style={recordingStore.active ? 'color:var(--ac)' : ''}
      >
        {recordingStore.active ? '⏺' : '🔴'} Aufnahme
      </button>
    </div>
    <button class="btn-icon" onclick={onclose} style="margin-left:0.5rem">✕</button>
  </div>

  <!-- Content -->
  <div class="panel-body" style="max-height:60vh;overflow-y:auto">
    {#if tab === 'tracks'}
      <TrackList />
    {:else}
      <RecordingPanel />
    {/if}
  </div>
</div>
