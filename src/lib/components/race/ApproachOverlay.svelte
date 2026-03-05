<script lang="ts">
  import { raceEngine } from '$lib/stores/race.svelte';

  // ── Farb-Interpolation: 100m amber → 5m grün → Puls an der Linie ──────────
  const overlayStyle = $derived((): string => {
    const d = raceEngine.distToStart;
    if (d === Infinity || d > 100) return '';

    let r: number, g: number, b: number, a: number;

    if (d <= 2) {
      r = 200; g = 255; b = 0; a = 0.30;
    } else if (d <= 5) {
      r = 200; g = 255; b = 0; a = 0.18;
    } else if (d <= 15) {
      const t = (d - 5) / 10;
      r = Math.round(200 + t * 45);
      g = Math.round(255 - t * 97);
      b = 0; a = 0.22 - t * 0.07;
    } else {
      const t = (d - 15) / 85;
      r = 245; g = 158; b = 11; a = 0.15 * (1 - t);
    }
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  });

  const isPulsing = $derived(raceEngine.state === 'at_line' && raceEngine.armed);
  const isAtLine  = $derived(raceEngine.state === 'at_line');

  const speedStr  = $derived(raceEngine.lastSpeedKmh > 0.5
    ? `${raceEngine.lastSpeedKmh.toFixed(1)} km/h`
    : '');

  const distColor = $derived(
    raceEngine.distToStart <= 2  ? '#c8ff00' :
    raceEngine.distToStart <= 10 ? '#f59e0b' :
    raceEngine.distToStart <= 30 ? '#fb923c' : '#e2e8f0'
  );

  const pct = $derived(
    Math.max(0, Math.min(100, (1 - raceEngine.distToStart / 100) * 100)).toFixed(1)
  );
</script>

{#if raceEngine.distToStart < 100 || raceEngine.state === 'at_line'}
  <!-- Vollbild-Hintergrund (Farb-Flash) -->
  <div
    class="approach-bg"
    class:pulsing={isPulsing}
    style="background:{overlayStyle()}"
  ></div>

  <!-- Haupt-Panel -->
  <div class="approach-panel">
    <!-- Distanz-Anzeige -->
    <div class="approach-dist-row">
      <div class="approach-dist" style="color:{distColor}">
        {#if isAtLine && raceEngine.distToStart <= 2}
          AN DER LINIE
        {:else}
          {raceEngine.distToStart.toFixed(1)}<span class="approach-unit">m</span>
        {/if}
      </div>
      {#if speedStr}
        <div class="approach-speed">{speedStr}</div>
      {/if}
    </div>

    <!-- Status -->
    <div class="approach-status">
      {#if isAtLine && raceEngine.armed}
        <span class="approach-ready">⚡ Bereit — Start automatisch</span>
      {:else if isAtLine && !raceEngine.armed}
        <span style="color:#f59e0b">An der Startlinie — Scharf schalten</span>
      {:else}
        <span style="color:var(--td)">Zur Startlinie fahren →</span>
      {/if}
    </div>

    <!-- Fortschrittsbalken -->
    <div class="approach-bar-outer">
      <div class="approach-bar-inner" style="width:{pct}%;background:{distColor}"></div>
    </div>

    <!-- Buttons -->
    <div class="approach-btns">
      {#if isAtLine && !raceEngine.armed}
        <button class="approach-btn approach-btn-arm" onclick={() => raceEngine.arm()}>
          🏁 Scharf schalten
        </button>
      {/if}
      {#if raceEngine.btConnected}
        <div class="approach-ble"><span style="color:#22c55e">●</span> Smartwatch verbunden</div>
      {:else}
        <button class="approach-btn approach-btn-ble" onclick={() => raceEngine.connectWatch()}>
          📡 Smartwatch verbinden
        </button>
      {/if}
      <button class="approach-btn approach-btn-abort" onclick={() => raceEngine.reset()}>
        Abbrechen ✕
      </button>
    </div>
  </div>
{/if}

<style>
  .approach-bg {
    position: fixed;
    inset: 0;
    z-index: 200;
    pointer-events: none;
    transition: background 0.4s ease;
  }
  .approach-bg.pulsing { animation: ap-pulse 0.9s ease infinite; }
  @keyframes ap-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

  .approach-panel {
    position: fixed;
    left: 50%;
    bottom: 6rem;
    transform: translateX(-50%);
    z-index: 210;
    background: rgba(11,14,20,0.92);
    border: 2px solid var(--bd2);
    border-radius: 1.5rem;
    padding: 1.25rem 1.75rem;
    min-width: 280px;
    max-width: calc(100vw - 2rem);
    text-align: center;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }

  .approach-dist-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
  }
  .approach-dist {
    font-family: var(--fh);
    font-size: 3.5rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.02em;
    transition: color 0.3s;
  }
  .approach-unit {
    font-size: 1.5rem;
    font-weight: 700;
    opacity: 0.7;
    margin-left: -0.1em;
  }
  .approach-speed {
    font-family: var(--fh);
    font-size: 1rem;
    font-weight: 600;
    color: var(--td);
    align-self: center;
  }

  .approach-status {
    font-family: var(--fh);
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-bottom: 0.75rem;
  }
  .approach-ready {
    color: var(--ac);
    animation: ap-pulse 0.9s ease infinite;
  }

  .approach-bar-outer {
    height: 6px;
    background: var(--s3);
    border-radius: 3px;
    margin-bottom: 0.9rem;
    overflow: hidden;
  }
  .approach-bar-inner {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s ease, background 0.3s;
  }

  .approach-btns {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    align-items: center;
  }
  .approach-btn {
    font-family: var(--fh);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.55rem 1.5rem;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    border: none;
    min-width: 180px;
  }
  .approach-btn:active { transform: scale(0.95); }
  .approach-btn-arm  { background:var(--ac); color:#000; font-size:1rem; padding:0.7rem 1.75rem; }
  .approach-btn-ble  { background:var(--s3); border:1px solid var(--bd2); color:var(--tx); }
  .approach-btn-abort{ background:transparent; border:1px solid rgba(239,68,68,0.4); color:#ef4444; font-size:0.8rem; }
  .approach-ble { font-size:0.8rem; color:var(--td); padding:0.3rem; }
</style>
