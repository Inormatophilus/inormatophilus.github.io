<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import QRScanner from '../../qr/QRScanner.svelte';

  let scannerActive = $state(false);
</script>

<div style="padding-top:0.75rem;display:flex;flex-direction:column;gap:0.75rem">
  <div class="card">
    <div class="form-label mb-2">QR-Code Scanner</div>
    <p class="text-sm text-dim mb-2">
      Scant QR-Code Sequenzen für Tracks, Projekte, Marker und Backups.
      Öffnet automatisch die Kamera.
    </p>
    <button
      class="btn {scannerActive ? 'btn-danger' : 'btn-primary'} w-full"
      onclick={() => scannerActive = !scannerActive}
    >
      {scannerActive ? '⏹ Scanner stoppen' : '📷 Scanner starten'}
    </button>
  </div>

  {#if scannerActive}
    <QRScanner onstop={() => scannerActive = false} />
  {/if}

  <div class="card card-sm">
    <div class="form-label mb-1">QR-Code Info</div>
    <div class="text-sm text-dim">
      <p>• Tracks: GPX-Daten als komprimierte QR-Sequenz</p>
      <p>• Multi-Chunk: Für große Dateien automatisch aufgeteilt</p>
      <p>• Kompatibel mit anderen GMTW-Installationen</p>
    </div>
  </div>
</div>
