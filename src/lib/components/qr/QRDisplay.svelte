<script lang="ts">
  import { QRAnimator } from '$lib/services/qr-engine';

  interface Props {
    chunks: string[];
    fps?: number;
    size?: number;
  }
  let { chunks, fps = 3, size = 280 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let animator: QRAnimator | null = null;
  let currentIdx = $state(0);
  let playing    = $state(true);

  $effect(() => {
    // (Re-)start animator whenever chunks or canvas change
    const _chunks = chunks; // read for reactivity
    if (!canvas) return;

    if (!animator) {
      animator = new QRAnimator(fps, size);
      animator.onFrame = (idx) => { currentIdx = idx; };
    } else {
      animator.stop();
    }
    currentIdx = 0;
    playing = true;
    if (_chunks.length > 0) animator.start(_chunks, canvas);

    return () => { animator?.stop(); };
  });

  function togglePlay() {
    if (!animator) return;
    if (playing) {
      animator.stop();
      playing = false;
    } else {
      animator.start(chunks, canvas);
      playing = true;
    }
  }

  function prev() { animator?.prev(); }
  function next() { animator?.next(); }
</script>

<div class="qr-canvas-wrap">
  <canvas bind:this={canvas} width={size} height={size} class="qr-canvas"
    style="width:{size}px;height:{size}px"></canvas>

  {#if chunks.length > 1}
    <div style="display:flex;align-items:center;gap:0.5rem">
      <button class="btn-icon btn-sm" onclick={prev} aria-label="Zurück">◀</button>
      <span class="text-sm text-dim">{currentIdx + 1}/{chunks.length}</span>
      <button class="btn-icon btn-sm" onclick={next} aria-label="Weiter">▶</button>
      <button class="btn-icon btn-sm" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
    </div>

    <!-- Chunk progress bar -->
    <div style="width:{size}px;height:4px;background:var(--s3);border-radius:2px">
      <div style="height:100%;background:var(--ac);border-radius:2px;width:{((currentIdx + 1) / chunks.length * 100).toFixed(1)}%;transition:width 0.1s"></div>
    </div>
  {/if}
</div>
