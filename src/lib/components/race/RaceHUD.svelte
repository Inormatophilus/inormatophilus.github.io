<script lang="ts">
  import { raceEngine } from '$lib/stores/race.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { mapStore } from '$lib/stores/map.svelte';
  import ApproachOverlay from './ApproachOverlay.svelte';
  import RaceTimer from './RaceTimer.svelte';
  import ResultCard from './ResultCard.svelte';

  // DeviceMotion — ACM/AVCM Mehrphasen-Sturzerkennung (Ring-Buffer)
  $effect(() => {
    if (typeof window === 'undefined') return;

    function onMotion(e: DeviceMotionEvent) {
      if (raceEngine.state !== 'racing') return;
      raceEngine.processAccel(e);          // Haupt-ACM (Sturz)
      raceEngine.processAccelDismount(e);  // Absteiger-Erkennung
    }

    // iOS: Permission erforderlich
    const DM = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DM.requestPermission === 'function') {
      DM.requestPermission().then(state => {
        if (state === 'granted') window.addEventListener('devicemotion', onMotion);
      }).catch(() => {});
    } else {
      window.addEventListener('devicemotion', onMotion);
    }

    return () => window.removeEventListener('devicemotion', onMotion);
  });
</script>

{#if raceEngine.state !== 'idle'}
  <div class="race-hud">
    {#if raceEngine.state === 'approaching' || raceEngine.state === 'at_line'}
      <ApproachOverlay />
    {:else if raceEngine.state === 'go' || raceEngine.state === 'racing'}
      <RaceTimer />
    {:else if raceEngine.state === 'finished'}
      <ResultCard />
    {/if}
  </div>
{/if}
