<script lang="ts">
  import { raceEngine } from '$lib/stores/race.svelte';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { formatDuration, formatSplitMs } from '$lib/services/geo';
  import { encodeObjectToChunks } from '$lib/services/qr-engine';
  import { db } from '$lib/services/database';
  import QRDisplay from '../qr/QRDisplay.svelte';
  import type { RunRecord } from '$lib/types';

  let run         = $state<RunRecord | null>(null);
  let allRuns     = $state<RunRecord[]>([]);
  let qrChunks    = $state<string[]>([]);
  let showQr      = $state(false);
  let showHistory = $state(false);

  $effect(() => {
    if (raceEngine.state === 'finished') {
      raceEngine.getLastRun().then(r => {
        run = r;
        if (r) qrChunks = encodeObjectToChunks(r, 'run');
      });
      if (raceEngine.trackId) {
        raceEngine.getRunsForTrack(raceEngine.trackId).then(runs => {
          allRuns = runs.sort((a, b) => a.totalMs - b.totalMs);
        });
      }
    }
  });

  const bestMs    = $derived(allRuns.length > 0 ? allRuns[0].totalMs : 0);
  const avgMs     = $derived(allRuns.length > 0
    ? Math.round(allRuns.reduce((s, r) => s + r.totalMs, 0) / allRuns.length) : 0);
  const isNewPb   = $derived(run !== null && allRuns.length > 0 && run.totalMs <= bestMs);
  const trackName = $derived(
    raceEngine.trackId ? (tracksStore.getTrack(raceEngine.trackId)?.name ?? '') : ''
  );

  async function shareResult() {
    if (!run) return;
    const lines = [
      'GMTW Race Result',
      'Track: ' + trackName,
      'Zeit: ' + formatDuration(run.totalMs),
      run.splits.length > 0
        ? 'Sektoren: ' + run.splits.map((s: number, i: number) => 'S'+(i+1)+' '+formatSplitMs(s)).join(', ')
        : '',
      run.fallEvents.length > 0 ? 'Stuerze: ' + run.fallEvents.length : '',
      run.signature ? 'Sig: ' + run.signature.slice(0, 16) + '...' : '',
    ].filter(Boolean).join('\n');
    if (navigator.share) {
      try { await navigator.share({ title: 'GMTW Race Result', text: lines }); return; } catch {}
    }
    await navigator.clipboard.writeText(lines);
    app.toast('Ergebnis kopiert', 'success');
  }

  async function deleteRun() {
    if (!run) return;
    if (!confirm('Run loeschen?')) return;
    await db.runs.delete(run.id);
    raceEngine.reset();
  }
</script>

{#if raceEngine.state === 'finished'}
<div class="rc-overlay">
  {#if run}
  <div class="rc-card">
    <div class="rc-header">
      {#if isNewPb}
        <div class="rc-pb-banner">NEUE BESTZEIT!</div>
      {:else}
        <div class="rc-trophy">🏆</div>
      {/if}
      <div class="rc-time" class:rc-pb={isNewPb}>{formatDuration(run.totalMs)}</div>
      <div class="rc-track-name">{trackName}</div>
      <div class="rc-date">{run.date}</div>
    </div>

    <div class="rc-divider"></div>

    {#if run.splits.length > 0}
    <div class="rc-section">
      <div class="rc-sect-title">Sektoren</div>
      {#each run.splits as split, i}
        {@const cumMs = run.splits.slice(0, i + 1).reduce((a: number, b: number) => a + b, 0)}
        <div class="rc-split-row">
          <span class="rc-split-label">Sektor {i + 1}</span>
          <span class="rc-split-val">{formatSplitMs(split)}</span>
          <span class="rc-split-cum">{formatDuration(cumMs)}</span>
        </div>
      {/each}
    </div>
    <div class="rc-divider"></div>
    {/if}

    {#if run.fallEvents.length > 0}
    <div class="rc-section">
      <div class="rc-sect-title" style="color:#f59e0b">{run.fallEvents.length}x Sturz / Absteiger</div>
      {#each run.fallEvents as e}
        <div class="rc-fall-row">
          <span>{e.type === 'fall' ? 'Sturz' : 'Absteiger'}</span>
          <span class="rc-fall-time">bei {(e.ts/1000).toFixed(1)}s</span>
        </div>
      {/each}
    </div>
    <div class="rc-divider"></div>
    {/if}

    {#if allRuns.length > 1}
    <div class="rc-section">
      <div class="rc-sect-title">Vergleich ({allRuns.length} Runs)</div>
      <div class="rc-compare-row">
        <span class="rc-compare-label">Bestzeit</span>
        <span class="rc-compare-val" style="color:var(--ac)">{formatDuration(bestMs)}</span>
      </div>
      <div class="rc-compare-row">
        <span class="rc-compare-label">Durchschnitt</span>
        <span class="rc-compare-val">{formatDuration(avgMs)}</span>
      </div>
      {#if !isNewPb}
      <div class="rc-compare-row">
        <span class="rc-compare-label">Rueckstand</span>
        <span class="rc-compare-val" style="color:#ef4444">+{formatDuration(run.totalMs - bestMs)}</span>
      </div>
      {/if}
    </div>
    <div class="rc-divider"></div>
    {/if}

    {#if run.signature}
    <div class="rc-section">
      <div class="rc-sect-title">HMAC-SHA256 Signatur</div>
      <code class="rc-sig">{run.signature}</code>
      <div class="rc-sig-note">{run.riderName || '–'} · {run.muniName || '–'} · {run.wheelSize}"</div>
    </div>
    <div class="rc-divider"></div>
    {/if}

    {#if showQr && qrChunks.length > 0}
    <div class="rc-section">
      <div class="rc-sect-title">QR-Code (Ergebnis)</div>
      <QRDisplay chunks={qrChunks} />
    </div>
    <div class="rc-divider"></div>
    {/if}

    {#if showHistory && allRuns.length > 1}
    <div class="rc-section">
      <div class="rc-sect-title">Alle Runs</div>
      {#each allRuns as r, i}
        <div class="rc-hist-row" class:rc-hist-current={r.id === run.id}>
          <span class="rc-hist-rank">#{i+1}</span>
          <span class="rc-hist-time">{formatDuration(r.totalMs)}</span>
          <span class="rc-hist-date">{r.date}</span>
          {#if r.fallEvents.length > 0}
            <span class="rc-hist-fall">{r.fallEvents.length}x</span>
          {/if}
        </div>
      {/each}
    </div>
    <div class="rc-divider"></div>
    {/if}

    <div class="rc-actions">
      <button class="rc-btn" onclick={() => showQr = !showQr}>{showQr ? 'QR ▲' : 'QR'}</button>
      {#if allRuns.length > 1}
        <button class="rc-btn" onclick={() => showHistory = !showHistory}>Historie</button>
      {/if}
      <button class="rc-btn" onclick={shareResult}>Teilen</button>
      <button class="rc-btn rc-btn-danger" onclick={deleteRun}>Löschen</button>
      <button class="rc-btn rc-btn-primary" onclick={() => raceEngine.reset()}>Fertig</button>
    </div>
  </div>
  {:else}
  <div class="rc-loading"><div class="spinner"></div></div>
  {/if}
</div>
{/if}

<style>
  .rc-overlay{position:fixed;inset:0;background:rgba(11,14,20,.96);z-index:310;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;}
  .rc-card{background:var(--s1);border:1px solid var(--bd2);border-radius:1.5rem;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.6);}
  .rc-header{padding:1.5rem 1.25rem .75rem;text-align:center;}
  .rc-trophy{font-size:2.5rem;line-height:1;margin-bottom:.5rem;}
  .rc-pb-banner{background:var(--ac);color:#000;font-family:var(--fh);font-size:13px;font-weight:800;letter-spacing:1px;padding:4px 14px;border-radius:10px;display:inline-block;margin-bottom:.5rem;animation:rc-pb .7s ease infinite;}
  @keyframes rc-pb{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  .rc-time{font-family:var(--fh);font-size:3.5rem;font-weight:900;color:var(--ac);line-height:1;letter-spacing:.03em;}
  .rc-time.rc-pb{text-shadow:0 0 20px rgba(200,255,0,.5);}
  .rc-track-name{font-family:var(--fh);font-size:.95rem;font-weight:700;color:var(--tx);margin-top:.35rem;}
  .rc-date{font-size:.8rem;color:var(--td);margin-top:.1rem;}
  .rc-divider{height:1px;background:var(--bd2);margin:.25rem 0;}
  .rc-section{padding:.6rem 1.25rem;}
  .rc-sect-title{font-family:var(--fh);font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--td);margin-bottom:.4rem;}
  .rc-split-row{display:flex;align-items:center;padding:.2rem 0;font-size:.85rem;}
  .rc-split-label{color:var(--td);flex:1;}
  .rc-split-val{font-family:var(--fh);font-weight:700;color:var(--tx);min-width:70px;text-align:right;}
  .rc-split-cum{font-family:var(--fh);font-size:.75rem;color:var(--td);min-width:60px;text-align:right;}
  .rc-fall-row{display:flex;justify-content:space-between;font-size:.82rem;padding:.15rem 0;color:#f59e0b;}
  .rc-fall-time{color:var(--td);}
  .rc-compare-row{display:flex;justify-content:space-between;font-size:.85rem;padding:.2rem 0;}
  .rc-compare-label{color:var(--td);}
  .rc-compare-val{font-family:var(--fh);font-weight:700;}
  .rc-sig{display:block;font-size:.68rem;word-break:break-all;color:var(--td);background:var(--s2);border-radius:6px;padding:4px 6px;font-family:monospace;margin-bottom:.25rem;}
  .rc-sig-note{font-size:.75rem;color:var(--td);}
  .rc-hist-row{display:flex;gap:.5rem;align-items:center;padding:.2rem 0;font-size:.82rem;border-bottom:1px solid var(--bd2);}
  .rc-hist-row:last-child{border-bottom:none;}
  .rc-hist-row.rc-hist-current{background:rgba(200,255,0,.05);}
  .rc-hist-rank{color:var(--td);min-width:24px;font-family:var(--fh);font-weight:700;}
  .rc-hist-time{font-family:var(--fh);font-weight:700;color:var(--tx);flex:1;}
  .rc-hist-date{color:var(--td);font-size:.75rem;}
  .rc-hist-fall{color:#f59e0b;font-size:.75rem;}
  .rc-actions{display:flex;gap:.5rem;padding:.75rem 1.25rem 1rem;flex-wrap:wrap;}
  .rc-btn{font-family:var(--fh);font-size:12px;font-weight:700;padding:.55rem .9rem;border-radius:10px;cursor:pointer;border:1px solid var(--bd2);background:var(--s2);color:var(--tx);transition:background .15s,transform .1s;flex:1;min-width:60px;}
  .rc-btn:active{transform:scale(.94);}
  .rc-btn-primary{background:var(--ac);color:#000;border-color:var(--ac);flex:2;}
  .rc-btn-danger{color:#ef4444;border-color:rgba(239,68,68,.35);flex:none;padding:.55rem .75rem;}
  .rc-loading{display:flex;align-items:center;justify-content:center;padding:3rem;}
  .spinner{width:36px;height:36px;border:3px solid var(--bd2);border-top-color:var(--ac);border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
