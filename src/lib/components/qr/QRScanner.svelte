<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChunkBuffer, parseChunkPayload, collectChunk, assembleChunks, decompressPayload, detectPayloadType, isFountainChunk, decodeFountainChunks } from '$lib/services/qr-engine';
  import { tracksStore } from '$lib/stores/tracks.svelte';
  import { markersStore } from '$lib/stores/markers.svelte';
  import { importFullBackup, importProjectJson } from '$lib/services/storage';
  import { app } from '$lib/stores/app.svelte';
  import type { QrChunkBuffer } from '$lib/types';

  interface Props {
    onstop?: () => void;
  }
  let { onstop }: Props = $props();

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let scanning = $state(false);
  let status   = $state('Starte Kamera…');
  let chunkBuf      = $state<QrChunkBuffer | null>(null);
  let fountainChunks = $state<string[]>([]);
  let fountainK      = $state(0);
  let progress = $state(0);
  let rafId    = 0;

  onMount(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }
      });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      status   = 'QR-Code in die Kamera halten…';
      scan();
    } catch (e) {
      status = `Kamera-Fehler: ${e}`;
    }
  });

  onDestroy(() => {
    stop();
  });

  function stop() {
    scanning = false;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
  }

  function scan() {
    if (!scanning) return;
    rafId = requestAnimationFrame(async () => {
      if (!video || video.readyState < 2) { scan(); return; }
      const ctx = canvas.getContext('2d')!;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Lazy-load jsQR
      const jsQR = (await import('jsqr')).default;
      const code  = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });

      if (code?.data) {
        await processQrData(code.data);
      }
      scan();
    });
  }

  async function processQrData(raw: string) {
    // ── Fountain-Code-Chunk ─────────────────────────────────────────────────
    if (isFountainChunk(raw)) {
      // Deduplizieren: gleiche chunks nicht mehrfach speichern
      if (fountainChunks.includes(raw)) return;
      fountainChunks = [...fountainChunks, raw];

      // k aus erstem Chunk auslesen
      if (fountainK === 0) {
        try { fountainK = (JSON.parse(raw) as { m: { k: number } }).m.k; } catch { /* */ }
      }
      progress = fountainK > 0 ? Math.min(99, (fountainChunks.length / fountainK) * 100) : 0;
      status   = `Fountain: ${fountainChunks.length}/${fountainK} Chunks`;

      // Versuch zu dekodieren (sobald >= k Chunks)
      if (fountainChunks.length >= fountainK) {
        const decoded = decodeFountainChunks(fountainChunks);
        if (decoded) {
          const jsonStr = decompressPayload(decoded);
          await processSinglePayload(jsonStr);
          fountainChunks = [];
          fountainK      = 0;
          progress       = 0;
        }
        // else: mehr chunks nötig, weiter scannen
      }
      return;
    }

    // ── Standard Sequential Chunks ──────────────────────────────────────────
    const chunk = parseChunkPayload(raw);
    if (!chunk) {
      // Try as direct JSON / GPX
      await processSinglePayload(raw);
      return;
    }

    if (!chunkBuf) {
      chunkBuf = createChunkBuffer();
    }

    const done = collectChunk(chunk, chunkBuf);
    progress   = chunkBuf.total > 0 ? (chunkBuf.chunks.size / chunkBuf.total) * 100 : 0;
    status     = `${chunkBuf.chunks.size}/${chunkBuf.total} Chunks empfangen`;

    if (done) {
      const assembled = assembleChunks(chunkBuf);
      const jsonStr   = decompressPayload(assembled);
      await processSinglePayload(jsonStr, chunkBuf.type);
      chunkBuf = null;
      progress = 0;
    }
  }

  async function processSinglePayload(jsonStr: string, hint?: string) {
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(jsonStr); } catch { parsed = jsonStr; }
      const type = hint ?? detectPayloadType(parsed);
      switch (type) {
        case 'track': {
          const data = JSON.parse(jsonStr);
          await tracksStore.loadGpxString(data.gpxString, data.name, data.cat);
          status = '✓ Track importiert';
          app.toast('Track per QR importiert', 'success');
          break;
        }
        case 'backup': {
          const data = JSON.parse(jsonStr);
          await importFullBackup(data);
          status = '✓ Backup importiert';
          app.toast('Backup importiert', 'success');
          break;
        }
        case 'project': {
          await importProjectJson(jsonStr);
          status = '✓ Projekt importiert';
          app.toast('Projekt importiert', 'success');
          break;
        }
        case 'marker': {
          const data = JSON.parse(jsonStr);
          await markersStore.addCustomMarker(data);
          status = '✓ Marker importiert';
          app.toast('Marker importiert', 'success');
          break;
        }
        default:
          status = `Unbekannter QR-Typ: ${type}`;
      }
      setTimeout(() => { stop(); onstop?.(); }, 1500);
    } catch (e) {
      status = `Fehler: ${e}`;
    }
  }
</script>

<div style="display:flex;flex-direction:column;gap:0.75rem">
  <div style="position:relative;border-radius:var(--r2);overflow:hidden;background:#000;aspect-ratio:1">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline autoplay muted style="width:100%;height:100%;object-fit:cover"></video>
    <canvas bind:this={canvas} style="display:none"></canvas>

    <!-- Viewfinder -->
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div style="width:60%;aspect-ratio:1;border:3px solid var(--ac);border-radius:var(--r);opacity:0.8"></div>
    </div>

    <!-- Progress overlay for multi-chunk -->
    {#if progress > 0 && progress < 100}
      <div style="position:absolute;bottom:0.5rem;left:1rem;right:1rem;height:6px;background:rgba(0,0,0,0.5);border-radius:3px">
        <div style="height:100%;background:var(--ac);border-radius:3px;width:{progress.toFixed(0)}%;transition:width 0.1s"></div>
      </div>
    {/if}
  </div>

  <div style="text-align:center;color:var(--td);font-size:0.875rem">{status}</div>

  <button class="btn btn-secondary w-full" onclick={() => { stop(); onstop?.(); }}>
    ⏹ Scanner stoppen
  </button>
</div>
