<script lang="ts">
  import { raceEngine } from '$lib/stores/race.svelte';
  import { formatSplitMs } from '$lib/services/geo';
  const NUM_SECTORS = 4;
  const timerColor = $derived(raceEngine.fallEvents.length > 0 ? '#f59e0b' : 'var(--ac)');
</script>

<div class="rt-hud">
  <div class="rt-timer" style="color:{timerColor}">{raceEngine.elapsedFormatted}</div>
  {#if raceEngine.lastSpeedKmh > 0.5}
    <div class="rt-speed">{raceEngine.lastSpeedKmh.toFixed(1)} km/h</div>
  {/if}
  <div class="rt-sectors">
    {#each Array(NUM_SECTORS) as _, i}
      {@const done    = i < raceEngine.splits.length}
      {@const current = i === raceEngine.splits.length && raceEngine.state === 'racing'}
      <div class="rt-sector-seg" class:done class:current>
        {#if done}
          <span class="rt-sector-time">{formatSplitMs(raceEngine.splits[i])}</span>
        {:else}
          <span class="rt-sector-num">S{i + 1}</span>
        {/if}
      </div>
    {/each}
  </div>
  {#if raceEngine.fallEvents.length > 0}
    <div class="rt-falls">
      {#each raceEngine.fallEvents as e, i}
        <span class="rt-fall-badge" title="{e.type === 'fall' ? 'Sturz' : 'Absteiger'} bei {(e.ts/1000).toFixed(1)}s">
          {e.type === 'fall' ? '⚠' : '⬇'}{i + 1}
        </span>
      {/each}
    </div>
  {/if}
  <div class="rt-controls">
    <button class="rt-btn rt-btn-dismount" onclick={() => raceEngine.recordFall('dismount')}>⬇ Absteiger</button>
    <button class="rt-btn rt-btn-fall"     onclick={() => raceEngine.recordFall('fall')}>⚠ Sturz</button>
    <button class="rt-btn rt-btn-abort"    onclick={() => raceEngine.reset()}>✕</button>
  </div>
</div>

<style>
  .rt-hud {
    position:fixed; top:4.5rem; left:50%; transform:translateX(-50%);
    z-index:250; background:rgba(11,14,20,0.94); border:2px solid var(--ac);
    border-radius:1.2rem; padding:0.75rem 1.25rem 0.65rem;
    min-width:240px; max-width:calc(100vw - 2rem); text-align:center;
    backdrop-filter:blur(10px); box-shadow:0 4px 24px rgba(0,0,0,0.6);
  }
  .rt-timer { font-family:var(--fh); font-size:3rem; font-weight:900; line-height:1; letter-spacing:.04em; transition:color .3s; }
  .rt-speed { font-family:var(--fh); font-size:.95rem; font-weight:700; color:var(--td); margin:.15rem 0 .35rem; }
  .rt-sectors { display:flex; gap:3px; margin:.4rem 0; }
  .rt-sector-seg {
    flex:1; height:26px; border-radius:5px; background:var(--s3); border:1px solid var(--bd2);
    display:flex; align-items:center; justify-content:center; transition:background .3s;
  }
  .rt-sector-seg.done    { background:rgba(200,255,0,.18); border-color:var(--ac); }
  .rt-sector-seg.current { border-color:var(--ac); animation:rt-blink .8s ease infinite; }
  @keyframes rt-blink { 0%,100%{border-color:var(--ac)} 50%{border-color:var(--bd2)} }
  .rt-sector-num  { font-family:var(--fh); font-size:10px; font-weight:700; color:var(--td); }
  .rt-sector-time { font-family:var(--fh); font-size:9px;  font-weight:800; color:var(--ac); }
  .rt-falls { display:flex; justify-content:center; gap:4px; flex-wrap:wrap; margin-bottom:.35rem; }
  .rt-fall-badge {
    font-family:var(--fh); font-size:10px; font-weight:700;
    background:rgba(245,158,11,.2); border:1px solid rgba(245,158,11,.5);
    color:#f59e0b; padding:1px 5px; border-radius:6px;
  }
  .rt-controls { display:flex; gap:5px; justify-content:center; margin-top:.45rem; }
  .rt-btn {
    font-family:var(--fh); font-size:11px; font-weight:700;
    padding:.35rem .65rem; border-radius:8px; cursor:pointer;
    border:1px solid var(--bd2); background:var(--s3); color:var(--tx);
    transition:background .15s,transform .1s;
  }
  .rt-btn:active { transform:scale(.93); }
  .rt-btn-dismount { color:#f59e0b; border-color:rgba(245,158,11,.35); }
  .rt-btn-fall     { color:#ef4444; border-color:rgba(239,68,68,.35); }
  .rt-btn-abort    { color:var(--td); padding:.35rem .5rem; }
</style>
