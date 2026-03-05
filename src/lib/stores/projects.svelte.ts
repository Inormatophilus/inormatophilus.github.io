// =============================================================================
// GMTW Trail Map — Projects Store (Svelte 5 Runes)
//
// Multi-Projekt State-Machine:
// - Fokus-Projekt (empfängt neue Inhalte, wird in Listen angezeigt)
// - Enabled-Konzept (Layer werden angezeigt oder ausgeblendet)
// - switchProject() → vollständige Isolation (alle anderen disabled)
// - toggleEnabled() → nur einen Projekt-Layer zeigen/verstecken
// =============================================================================

import { db } from '$lib/services/database';
import { lsGet, lsSet, LS_KEYS } from '$lib/services/storage';
import { exportProjectJson, importProjectJson } from '$lib/services/storage';
import { app } from './app.svelte';
import type { Project } from '$lib/types';

// ---------------------------------------------------------------------------
// ProjectsStore class
// ---------------------------------------------------------------------------

class ProjectsStore {
  projects       = $state<Project[]>([]);
  activeProjectId = $state<string | null>(null);
  createMode     = $state(false);   // dblclick mode for new project
  step2Open      = $state(false);   // step2 bottom sheet
  step2Coords    = $state<{ lat: number; lng: number; zoom: number } | null>(null);

  // Derived
  activeProject = $derived(
    this.projects.find(p => p.id === this.activeProjectId) ?? null
  );
  enabledProjects = $derived(
    this.projects.filter(p => p.enabled !== false)
  );

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    const stored = await db.projects.toArray();
    if (stored.length === 0) {
      // Kein Projekt vorhanden — Standard-Projekt anlegen
      const def = await this._createDefault();
      this.projects = [def];
      this.activeProjectId = def.id;
    } else {
      // enabled-Feld migrieren (alte Einträge ohne enabled)
      for (const p of stored) {
        if (p.enabled === undefined) {
          p.enabled = true;
          await db.projects.put(p);
        }
      }
      this.projects = stored.sort((a, b) => a.createdAt - b.createdAt);
      // Active project aus LS laden
      const savedActive = lsGet<string | null>(LS_KEYS.ACTIVE_PROJECT, null);
      if (savedActive && stored.find(p => p.id === savedActive)) {
        this.activeProjectId = savedActive;
      } else {
        this.activeProjectId = stored[0].id;
        lsSet(LS_KEYS.ACTIVE_PROJECT, this.activeProjectId);
      }
    }
  }

  private async _createDefault(): Promise<Project> {
    const proj: Project = {
      id: `proj_${Date.now()}`,
      name: 'GMTW 26',
      centerLat: 51.4192,
      centerLng: 7.4855,
      zoom: 16,
      enabled: true,
      createdAt: Date.now(),
    };
    await db.projects.put(proj);
    lsSet(LS_KEYS.ACTIVE_PROJECT, proj.id);
    return proj;
  }

  // ---------------------------------------------------------------------------
  // Focus (sets active project without layer changes)
  // ---------------------------------------------------------------------------

  setFocus(id: string): void {
    const p = this.projects.find(p => p.id === id);
    if (!p) return;
    this.activeProjectId = id;
    lsSet(LS_KEYS.ACTIVE_PROJECT, id);
  }

  // ---------------------------------------------------------------------------
  // Switch (full isolation — disables all others)
  // ---------------------------------------------------------------------------

  async switchProject(id: string): Promise<void> {
    const target = this.projects.find(p => p.id === id);
    if (!target) return;

    // Disable all other projects
    for (const p of this.projects) {
      if (p.id !== id && p.enabled) {
        p.enabled = false;
        await db.projects.put({ ...p });
      }
    }

    // Enable target
    target.enabled = true;
    await db.projects.put({ ...target });

    // Update reactive state
    this.projects = [...this.projects];
    this.setFocus(id);
  }

  // ---------------------------------------------------------------------------
  // Toggle Enabled (show/hide ONE project without changing focus)
  // ---------------------------------------------------------------------------

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    const p = this.projects.find(p => p.id === id);
    if (!p) return;
    p.enabled = enabled;
    await db.projects.put({ ...p });
    this.projects = [...this.projects];
  }

  // ---------------------------------------------------------------------------
  // Create Mode (dblclick on map to pick location)
  // ---------------------------------------------------------------------------

  startCreateMode(): void {
    this.createMode = true;
  }

  cancelCreateMode(): void {
    this.createMode = false;
    this.step2Open  = false;
    this.step2Coords = null;
  }

  openStep2(lat: number, lng: number, zoom: number): void {
    this.createMode  = false;
    this.step2Coords = { lat, lng, zoom };
    this.step2Open   = true;
  }

  closeStep2(): void {
    this.step2Open  = false;
    this.step2Coords = null;
  }

  // ---------------------------------------------------------------------------
  // Create / Delete
  // ---------------------------------------------------------------------------

  async createProject(name: string, lat: number, lng: number, zoom: number): Promise<Project> {
    const proj: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      centerLat: lat,
      centerLng: lng,
      zoom,
      enabled: true,
      createdAt: Date.now(),
    };
    await db.projects.put(proj);
    this.projects = [...this.projects, proj];
    this.setFocus(proj.id);
    app.toast(`Projekt "${name}" erstellt`, 'success');
    return proj;
  }

  async deleteProject(id: string): Promise<void> {
    if (this.projects.length <= 1) {
      app.toast('Letztes Projekt kann nicht gelöscht werden', 'error');
      return;
    }

    // Re-assign tracks and markers to first remaining project
    const remaining = this.projects.filter(p => p.id !== id);
    const fallback  = remaining[0];

    await db.tracks.where('projectId').equals(id).modify({ projectId: fallback.id });
    await db.customMarkers.where('projectId').equals(id).modify({ projectId: fallback.id });

    await db.projects.delete(id);
    this.projects = remaining;

    if (this.activeProjectId === id) {
      this.setFocus(fallback.id);
    }
    app.toast('Projekt gelöscht', 'info');
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async updateProject(id: string, changes: Partial<Project>): Promise<void> {
    const p = this.projects.find(p => p.id === id);
    if (!p) return;
    Object.assign(p, changes);
    await db.projects.put({ ...p });
    this.projects = [...this.projects];
  }

  async setCenterFromMap(id: string, lat: number, lng: number, zoom: number): Promise<void> {
    await this.updateProject(id, { centerLat: lat, centerLng: lng, zoom });
    app.toast('Projektmittelpunkt gespeichert', 'success');
  }

  // ---------------------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------------------

  async exportProject(id: string): Promise<void> {
    const p = this.projects.find(p => p.id === id);
    if (!p) return;
    try {
      const json = await exportProjectJson(id);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `gmtw-projekt-${p.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      app.toast('Export fehlgeschlagen', 'error');
      console.error(err);
    }
  }

  async importProjectFromJson(json: string): Promise<void> {
    try {
      const newId = await importProjectJson(json);
      // Reload from DB
      await this.init();
      this.setFocus(newId);
      app.toast('Projekt importiert', 'success');
    } catch (err) {
      app.toast('Import fehlgeschlagen', 'error');
      console.error(err);
    }
  }
}

export const projectsStore = new ProjectsStore();
