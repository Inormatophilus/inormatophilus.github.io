<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { exportFullBackup, importFullBackup } from '$lib/services/storage';
  import { getStorageInfo, requestPersistentStorage } from '$lib/services/storage';
  import { db } from '$lib/services/database';

  let storageInfo = $state<{ used: number; quota: number; persistent: boolean } | null>(null);
  let importing   = $state(false);
  let fileInput:  HTMLInputElement;

  async function loadStorageInfo() {
    storageInfo = await getStorageInfo();
  }
  $effect(() => { loadStorageInfo(); });

  async function doExport() {
    try {
      const backup = await exportFullBackup();
      const json   = JSON.stringify(backup, null, 2);
      const blob   = new Blob([json], { type: 'application/json' });
      const a      = document.createElement('a');
      a.href       = URL.createObjectURL(blob);
      a.download   = `gmtw-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      app.toast('Backup exportiert', 'success');
    } catch (e) {
      app.toast(`Export fehlgeschlagen: ${e}`, 'error');
    }
  }

  async function doImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    importing = true;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importFullBackup(data);
      app.toast('Backup importiert — Bitte Seite neu laden', 'success', 5000);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      app.toast(`Import fehlgeschlagen: ${e}`, 'error');
    } finally {
      importing = false;
      input.value = '';
    }
  }

  async function makePersistent() {
    const ok = await requestPersistentStorage();
    app.toast(ok ? 'Persistenter Speicher aktiviert' : 'Abgelehnt', ok ? 'success' : 'warn');
    storageInfo = await getStorageInfo();
  }

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div style="padding-top:0.75rem;display:flex;flex-direction:column;gap:0.75rem">

  <!-- Backup Export/Import -->
  <div class="card">
    <div class="form-label mb-2">Vollständiges Backup (v8)</div>
    <p class="text-sm text-dim mb-2">
      Sichert alle Tracks, Rennergebnisse, Marker, Projekte und Einstellungen.
    </p>
    <div style="display:flex;gap:0.5rem">
      <button class="btn btn-primary flex-1" onclick={doExport}>💾 Exportieren</button>
      <button class="btn btn-secondary flex-1" onclick={() => fileInput.click()} disabled={importing}>
        {importing ? '⏳' : '📂 Importieren'}
      </button>
    </div>
    <input bind:this={fileInput} type="file" accept=".json" style="display:none" onchange={doImport} />
  </div>

  <!-- Storage Info -->
  {#if storageInfo}
    <div class="card">
      <div class="form-label mb-2">Speichernutzung</div>
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm">Belegt</span>
          <span class="text-sm font-head">{formatBytes(storageInfo.used)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-sm">Verfügbar</span>
          <span class="text-sm font-head">{formatBytes(storageInfo.quota)}</span>
        </div>
        <!-- Usage bar -->
        <div style="height:6px;background:var(--s3);border-radius:3px;margin-top:0.25rem">
          <div style="height:100%;border-radius:3px;background:var(--ac);width:{Math.min(100, (storageInfo.used / Math.max(1, storageInfo.quota)) * 100).toFixed(1)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="text-xs text-dim">Persistenter Speicher: {storageInfo.persistent ? '✓ Ja' : '✗ Nein'}</span>
          {#if !storageInfo.persistent}
            <button class="btn btn-ghost btn-sm" onclick={makePersistent}>Aktivieren</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Danger Zone -->
  <div class="card" style="border-color:#ef4444">
    <div class="form-label mb-2" style="color:#ef4444">⚠ Alles löschen</div>
    <p class="text-sm text-dim mb-2">Löscht ALLE Daten unwiderruflich.</p>
    <button
      class="btn btn-danger w-full"
      onclick={async () => {
        if (!confirm('ALLE Daten löschen? Nicht rückgängig zu machen!')) return;
        await db.tracks.clear();
        await db.runs.clear();
        await db.customMarkers.clear();
        await db.trackMeta.clear();
        localStorage.clear();
        app.toast('Alle Daten gelöscht', 'success');
        setTimeout(() => window.location.reload(), 1500);
      }}
    >🗑 Alles löschen</button>
  </div>

</div>
