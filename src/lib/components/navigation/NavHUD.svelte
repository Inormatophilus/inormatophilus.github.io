<script lang="ts">
  import { navigationStore } from '$lib/stores/navigation.svelte';

  // Kompass-Pfeil-Rotation
  const arrowStyle = $derived(
    `transform: rotate(${navigationStore.bearingToNext}deg); transition: transform 0.4s ease;`
  );

  // XTE-Balken: -30m bis +30m → 0-100%
  const xteClamp = $derived(Math.max(-30, Math.min(30, navigationStore.xte)));
  const xtePct   = $derived(50 + (xteClamp / 30) * 50); // 0%=links, 50%=mitte, 100%=rechts
  const xteAbs   = $derived(Math.abs(navigationStore.xte));
  const xteColor = $derived(
    xteAbs < 3  ? 'var(--ac)' :
    xteAbs < 10 ? '#f59e0b' : '#ef4444'
  );

  // Fortschritt 0-100
  const pct = $derived((navigationStore.progress * 100).toFixed(0));
</script>

{#if navigationStore.active}
<div class="nav-hud">
  <!-- Kompass-Ring + Pfeil -->
  <div class="nav-compass">
    <div class="nav-compass-ring">
      <!-- Himmelsrichtungen -->
      <span class="nav-dir nav-dir-n">N</span>
      <span class="nav-dir nav-dir-e">E</span>
      <span class="nav-dir nav-dir-s">S</span>
      <span class="nav-dir nav-dir-w">W</span>
      <!-- Pfeil -->
      <div class="nav-arrow-wrap" style={arrowStyle}>
        <div class="nav-arrow">▲</div>
      </div>
    </div>
  </div>

  <!-- Distanz + Label -->
  <div class="nav-info">
    <div class="nav-dist">{navigationStore.distFormatted}</div>
    <div class="nav-label">{navigationStore.nextLabel || 'Nächster Wegpunkt'}</div>

    <!-- XTE-Balken (Cross-Track-Error) -->
    <div class="nav-xte-wrap" title="Spurabweichung: {navigationStore.xteFormatted}">
      <span class="nav-xte-side">L</span>
      <div class="nav-xte-bar">
        <div class="nav-xte-mid"></div>
        <div
          class="nav-xte-dot"
          style="left:{xtePct.toFixed(1)}%;background:{xteColor}"
        ></div>
      </div>
      <span class="nav-xte-side">R</span>
    </div>

    {#if xteAbs > 1}
      <div class="nav-xte-label" style="color:{xteColor}">
        {xteAbs.toFixed(0)}m {navigationStore.xte > 0 ? 'rechts' : 'links'}
      </div>
    {:else}
      <div class="nav-xte-label" style="color:var(--ac)">Auf Kurs</div>
    {/if}

    <!-- Fortschrittsbalken -->
    <div class="nav-progress-bar">
      <div class="nav-progress-fill" style="width:{pct}%"></div>
    </div>
    <div class="nav-progress-label">
      {pct}% · {navigationStore.coveredFormatted ?? ''} / {navigationStore.totalFormatted ?? ''}
    </div>
  </div>

  <!-- Stop-Button -->
  <button class="nav-stop" onclick={() => navigationStore.stop()} aria-label="Navigation beenden">
    ✕
  </button>
</div>
{/if}

<style>
  .nav-hud {
    position: fixed;
    top: 4.5rem;
    left: 0.75rem;
    z-index: 240;
    background: rgba(11,14,20,0.92);
    border: 1px solid var(--bd2);
    border-radius: 1rem;
    padding: 0.6rem 0.75rem 0.55rem;
    width: 160px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
  }

  /* ── Kompass ─────────────────────────────────────────────────────── */
  .nav-compass {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
  }
  .nav-compass-ring {
    width: 100%;
    height: 100%;
    border: 2px solid var(--bd2);
    border-radius: 50%;
    position: relative;
    background: var(--s2);
  }
  .nav-dir {
    position: absolute;
    font-family: var(--fh);
    font-size: 9px;
    font-weight: 800;
    color: var(--td);
    line-height: 1;
  }
  .nav-dir-n { top: 2px;  left: 50%; transform: translateX(-50%); color: var(--ac); }
  .nav-dir-s { bottom: 2px; left: 50%; transform: translateX(-50%); }
  .nav-dir-e { right: 3px; top: 50%; transform: translateY(-50%); }
  .nav-dir-w { left: 3px;  top: 50%; transform: translateY(-50%); }

  .nav-arrow-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }
  .nav-arrow {
    font-size: 1.5rem;
    color: var(--ac);
    line-height: 1;
    margin-top: -4px;
    filter: drop-shadow(0 0 4px rgba(200,255,0,0.6));
  }

  /* ── Info ────────────────────────────────────────────────────────── */
  .nav-info {
    width: 100%;
    text-align: center;
  }
  .nav-dist {
    font-family: var(--fh);
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--ac);
    line-height: 1;
  }
  .nav-label {
    font-family: var(--fh);
    font-size: 9px;
    color: var(--td);
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-bottom: 0.35rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── XTE-Balken ──────────────────────────────────────────────────── */
  .nav-xte-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    margin-bottom: 1px;
  }
  .nav-xte-side {
    font-family: var(--fh);
    font-size: 8px;
    font-weight: 700;
    color: var(--td);
    flex-shrink: 0;
  }
  .nav-xte-bar {
    flex: 1;
    height: 6px;
    background: var(--s3);
    border-radius: 3px;
    position: relative;
    border: 1px solid var(--bd2);
  }
  .nav-xte-mid {
    position: absolute;
    left: 50%;
    top: 0; bottom: 0;
    width: 1px;
    background: var(--bd2);
  }
  .nav-xte-dot {
    position: absolute;
    top: 50%;
    width: 8px; height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: left 0.4s ease, background 0.3s;
    box-shadow: 0 0 4px currentColor;
  }
  .nav-xte-label {
    font-family: var(--fh);
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 0.3rem;
  }

  /* ── Fortschritt ─────────────────────────────────────────────────── */
  .nav-progress-bar {
    height: 4px;
    background: var(--s3);
    border-radius: 2px;
    width: 100%;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .nav-progress-fill {
    height: 100%;
    background: var(--ac);
    border-radius: 2px;
    transition: width 0.6s ease;
  }
  .nav-progress-label {
    font-family: var(--fh);
    font-size: 8px;
    color: var(--td);
    text-align: center;
  }

  /* ── Stop ────────────────────────────────────────────────────────── */
  .nav-stop {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--s3);
    border: 1px solid var(--bd2);
    color: var(--td);
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav-stop:hover { color: #ef4444; border-color: rgba(239,68,68,0.5); }
</style>
