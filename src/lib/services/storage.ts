// =============================================================================
// GMTW Trail Map — Storage Service
//
// Features:
// - LocalStorage Key-Konstanten (LS_KEYS)
// - v8-Backup Export/Import (vollständige Datensicherung)
// - Per-Projekt-Export (JSON mit Tracks + Markers + Meta)
// - LOCS-Overrides Persistenz
// - Einstellungen (Theme, Lang, GPS-Emoji, Home-Region etc.)
// =============================================================================

import { db, serializeTrack, serializeMarker, type TrackMeta } from './database';
import type {
  BackupV8,
  BackupSettings,
  GmtwTrack,
  CustomMarker,
  Project,
  UserProfile,
  A11ySettings,
  LocsOverride,
  Lang,
  TrackFeature,
  TrackEdit
} from '$lib/types';

// ---------------------------------------------------------------------------
// LocalStorage Keys
// ---------------------------------------------------------------------------

export const LS_KEYS = {
  THEME:           'gmtw_theme',
  LANG:            'gmtw_lang_v1',
  GPS_EMOJI:       'gmtw_gps_emoji',
  HOME_REGION:     'gmtw_home_region',
  VIEW:            'gmtw_view_v1',
  PROFILE:         'gmtw_profile_v1',
  A11Y:            'gmtw_a11y_v1',
  PROJECTS:        'gmtw_projects_v1',
  ACTIVE_PROJECT:  'gmtw_active_project_v1',
  MARKER_SCALE:    'gmtw_marker_scale_v1',
  LOCS_OVERRIDES:  'gmtw_locs_overrides_v1',
  LOCS_HIDDEN:     'gmtw_locs_hidden_v1',
  RECORDING:       'gmtw_rec_v2',
  INSTALL_DECLINE_TS:   'gmtw_install_decline_ts',
  INSTALL_DECLINE_PERM: 'gmtw_install_decline_perm',
} as const;

export type LsKey = typeof LS_KEYS[keyof typeof LS_KEYS];

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function lsDel(key: string): void {
  localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Full Backup v8 Export
// ---------------------------------------------------------------------------

/**
 * Exportiert alle Daten aus IndexedDB + LocalStorage als JSON-Backup (v8).
 * Gibt Promise<BackupV8> zurück.
 */
export async function exportFullBackup(): Promise<BackupV8> {
  // IndexedDB Daten laden
  const tracks       = await db.tracks.toArray();
  const runs         = await db.runs.toArray();
  const customMarkers = await db.customMarkers.toArray();
  const trackMetaArr = await db.trackMeta.toArray();
  const projects     = await db.projects.toArray();
  const locsOverArr  = await db.locsOverrides.toArray();

  // TrackMeta nach trackId indizieren
  const trkFeatures: Record<string, TrackFeature[]> = {};
  const trkRatings:  Record<string, number>         = {};
  const trkEdits:    Record<string, TrackEdit[]>    = {};
  for (const m of trackMetaArr) {
    if (m.features?.length)  trkFeatures[m.trackId] = m.features;
    if (m.rating !== undefined) trkRatings[m.trackId] = m.rating;
    if (m.edits?.length)     trkEdits[m.trackId]    = m.edits;
  }

  // LocsOverrides als Record
  const locsOverrides: Record<string, LocsOverride> = {};
  for (const o of locsOverArr) {
    locsOverrides[o.id] = o;
  }

  // Settings aus LocalStorage
  const settings: BackupSettings = {
    gpsEmoji:      lsGet(LS_KEYS.GPS_EMOJI, '🦄'),
    homeRegion:    lsGet<{ lat: number; lng: number } | null>(LS_KEYS.HOME_REGION, null),
    theme:         lsGet<'dark' | 'light'>(LS_KEYS.THEME, 'dark'),
    lastView:      lsGet<{ lat: number; lng: number; zoom: number } | null>(LS_KEYS.VIEW, null),
    markerScale:   lsGet(LS_KEYS.MARKER_SCALE, 1.0),
    locsHidden:    lsGet<string[]>(LS_KEYS.LOCS_HIDDEN, []),
    locsOverrides,
    profile:       lsGet<UserProfile | null>(LS_KEYS.PROFILE, null),
    a11y:          lsGet<A11ySettings | null>(LS_KEYS.A11Y, null) ?? undefined,
    projects,
    activeProjectId: lsGet<string | null>(LS_KEYS.ACTIVE_PROJECT, null),
    lang:          lsGet<string>(LS_KEYS.LANG, 'de') as Lang,
  };

  return {
    _app:       'gmtw-v8',
    exportedAt: new Date().toISOString(),
    tracks:     tracks.map(serializeTrack),
    runs,
    customMarkers: customMarkers.map(serializeMarker),
    trkFeatures,
    trkRatings,
    trkEdits,
    settings,
  };
}

// ---------------------------------------------------------------------------
// Full Backup v8 Import (Merge)
// ---------------------------------------------------------------------------

/**
 * Importiert ein v8-Backup. Mergt alle Daten (überschreibt per ID).
 * @throws {Error} wenn das Backup nicht valide ist
 */
export async function importFullBackup(raw: unknown): Promise<void> {
  const backup = raw as BackupV8;
  if (!backup || !backup._app?.startsWith('gmtw')) {
    throw new Error('Kein gültiges GMTW v8-Backup');
  }

  // Tracks importieren
  if (Array.isArray(backup.tracks)) {
    const clean = backup.tracks.map(sanitizeTrack);
    await db.tracks.bulkPut(clean);
  }

  // Runs importieren
  if (Array.isArray(backup.runs)) {
    await db.runs.bulkPut(backup.runs);
  }

  // Custom Markers importieren
  if (Array.isArray(backup.customMarkers)) {
    const clean = backup.customMarkers.map(sanitizeMarker);
    await db.customMarkers.bulkPut(clean);
  }

  // TrackMeta (features, ratings, edits) zusammenführen
  const allTrackIds = new Set<string>();
  if (backup.trkFeatures) Object.keys(backup.trkFeatures).forEach(k => allTrackIds.add(k));
  if (backup.trkRatings)  Object.keys(backup.trkRatings).forEach(k => allTrackIds.add(k));
  if (backup.trkEdits)    Object.keys(backup.trkEdits).forEach(k => allTrackIds.add(k));

  for (const trackId of allTrackIds) {
    const existing = await db.trackMeta.get(trackId) ?? { trackId, features: [], rating: undefined, edits: [] };
    if (backup.trkFeatures?.[trackId]) existing.features = backup.trkFeatures[trackId] as TrackMeta['features'];
    if (backup.trkRatings?.[trackId] !== undefined) existing.rating = backup.trkRatings[trackId];
    if (backup.trkEdits?.[trackId])    existing.edits    = backup.trkEdits[trackId] as TrackMeta['edits'];
    await db.trackMeta.put(existing);
  }

  // Projects importieren
  if (Array.isArray(backup.settings?.projects)) {
    await db.projects.bulkPut(backup.settings.projects);
  }

  // Settings in LocalStorage schreiben
  const s = backup.settings;
  if (s) {
    if (s.gpsEmoji)    lsSet(LS_KEYS.GPS_EMOJI, s.gpsEmoji);
    if (s.homeRegion)  lsSet(LS_KEYS.HOME_REGION, s.homeRegion);
    if (s.theme)       lsSet(LS_KEYS.THEME, s.theme);
    if (s.lastView)    lsSet(LS_KEYS.VIEW, s.lastView);
    if (s.markerScale !== undefined) lsSet(LS_KEYS.MARKER_SCALE, s.markerScale);
    if (s.profile)     lsSet(LS_KEYS.PROFILE, s.profile);
    if (s.a11y)        lsSet(LS_KEYS.A11Y, s.a11y);
    if (s.lang)        lsSet(LS_KEYS.LANG, s.lang);
    if (s.activeProjectId) lsSet(LS_KEYS.ACTIVE_PROJECT, s.activeProjectId);
    if (s.locsHidden)  lsSet(LS_KEYS.LOCS_HIDDEN, s.locsHidden);

    // LOCS Overrides
    if (s.locsOverrides) {
      for (const [id, override] of Object.entries(s.locsOverrides)) {
        await db.locsOverrides.put({ ...override, id });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Per-Projekt Export
// ---------------------------------------------------------------------------

/**
 * Exportiert ein einzelnes Projekt als JSON-String.
 * Enthält: Tracks + CustomMarkers + TrackMeta + Projektdaten
 */
export async function exportProjectJson(projectId: string): Promise<string> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error(`Projekt ${projectId} nicht gefunden`);

  const tracks        = await db.tracks.where('projectId').equals(projectId).toArray();
  const customMarkers = await db.customMarkers.where('projectId').equals(projectId).toArray();

  // TrackMeta für alle Tracks dieses Projekts
  const trkFeatures: Record<string, TrackFeature[]> = {};
  const trkRatings:  Record<string, number>         = {};
  const trkEdits:    Record<string, TrackEdit[]>    = {};
  for (const t of tracks) {
    const meta = await db.trackMeta.get(t.id);
    if (meta?.features?.length) trkFeatures[t.id] = meta.features;
    if (meta?.rating !== undefined) trkRatings[t.id] = meta.rating;
    if (meta?.edits?.length) trkEdits[t.id] = meta.edits;
  }

  const payload = {
    _app: 'gmtw-project-v1',
    project: sanitizeProject(project),
    tracks: tracks.map(serializeTrack),
    customMarkers: customMarkers.map(serializeMarker),
    trkFeatures,
    trkRatings,
    trkEdits,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Importiert ein per-Projekt-JSON.
 * Erstellt ein neues Projekt (neue ID) und importiert alle zugehörigen Daten.
 */
export async function importProjectJson(json: string): Promise<string> {
  const payload = JSON.parse(json);
  if (!payload || payload._app !== 'gmtw-project-v1') {
    throw new Error('Kein gültiges GMTW-Projekt-Backup');
  }

  // Neues Projekt mit neuer ID anlegen (Kollision vermeiden)
  const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const project: Project = {
    ...sanitizeProject(payload.project),
    id: newProjectId,
    createdAt: Date.now(),
  };
  await db.projects.put(project);

  // Tracks mit neuer projectId importieren
  const idMap: Record<string, string> = {};
  if (Array.isArray(payload.tracks)) {
    for (const t of payload.tracks) {
      const newId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      idMap[t.id] = newId;
      const clean = { ...sanitizeTrack(t), id: newId, projectId: newProjectId };
      await db.tracks.put(clean);
    }
  }

  // Custom Markers mit neuer projectId importieren
  if (Array.isArray(payload.customMarkers)) {
    for (const m of payload.customMarkers) {
      const newId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const clean = { ...sanitizeMarker(m), id: newId, projectId: newProjectId };
      await db.customMarkers.put(clean);
    }
  }

  // TrackMeta mit neuen IDs importieren
  if (payload.trkFeatures || payload.trkRatings || payload.trkEdits) {
    for (const [oldId, newId] of Object.entries(idMap)) {
      const meta: TrackMeta = { trackId: newId, features: [], edits: [] };
      if (payload.trkFeatures?.[oldId]) meta.features = payload.trkFeatures[oldId];
      if (payload.trkRatings?.[oldId] !== undefined) meta.rating = payload.trkRatings[oldId];
      if (payload.trkEdits?.[oldId]) meta.edits = payload.trkEdits[oldId];
      await db.trackMeta.put(meta);
    }
  }

  return newProjectId;
}

// ---------------------------------------------------------------------------
// Sanitize helpers (nicht-serialisierbare Felder entfernen)
// ---------------------------------------------------------------------------

function sanitizeTrack(t: GmtwTrack): GmtwTrack {
  // Leaflet Laufzeit-Objekte entfernen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { gpxLayer, _startMkr, _finishMkr, ...rest } = t as any;
  void gpxLayer; void _startMkr; void _finishMkr;
  return rest as GmtwTrack;
}

function sanitizeMarker(m: CustomMarker): CustomMarker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { _leafletMarker, ...rest } = m as any;
  void _leafletMarker;
  return rest as CustomMarker;
}

function sanitizeProject(p: Project): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { _layers, ...rest } = p as any;
  void _layers;
  return rest as Project;
}

// ---------------------------------------------------------------------------
// Settings Helpers
// ---------------------------------------------------------------------------

export function loadTheme(): 'dark' | 'light' {
  return lsGet<'dark' | 'light'>(LS_KEYS.THEME, 'dark');
}

export function saveTheme(theme: 'dark' | 'light'): void {
  lsSet(LS_KEYS.THEME, theme);
}

export function loadLang(): string {
  return lsGet<string>(LS_KEYS.LANG, 'de');
}

export function saveLang(lang: string): void {
  lsSet(LS_KEYS.LANG, lang);
}

export function loadProfile(): UserProfile | null {
  return lsGet<UserProfile | null>(LS_KEYS.PROFILE, null);
}

export function saveProfile(profile: UserProfile): void {
  lsSet(LS_KEYS.PROFILE, profile);
}

export function loadA11y(): A11ySettings {
  return lsGet<A11ySettings>(LS_KEYS.A11Y, {
    enabled: false,
    rate: 1.0,
    hc: false,
    autoAnnounce: true,
  });
}

export function saveA11y(settings: A11ySettings): void {
  lsSet(LS_KEYS.A11Y, settings);
}

export function loadMarkerScale(): number {
  return lsGet<number>(LS_KEYS.MARKER_SCALE, 1.0);
}

export function saveMarkerScale(scale: number): void {
  lsSet(LS_KEYS.MARKER_SCALE, scale);
}

export function loadGpsEmoji(): string {
  return lsGet<string>(LS_KEYS.GPS_EMOJI, '🦄');
}

export function saveGpsEmoji(emoji: string): void {
  lsSet(LS_KEYS.GPS_EMOJI, emoji);
}

export function loadHomeRegion(): { lat: number; lng: number } | null {
  return lsGet<{ lat: number; lng: number } | null>(LS_KEYS.HOME_REGION, null);
}

export function saveHomeRegion(lat: number, lng: number): void {
  lsSet(LS_KEYS.HOME_REGION, { lat, lng });
}

export function loadMapView(): { lat: number; lng: number; zoom: number } | null {
  return lsGet<{ lat: number; lng: number; zoom: number } | null>(LS_KEYS.VIEW, null);
}

export function saveMapView(lat: number, lng: number, zoom: number): void {
  lsSet(LS_KEYS.VIEW, { lat, lng, zoom });
}

// ---------------------------------------------------------------------------
// Recording State (Auto-Recovery) — persisted subset for crash recovery
// ---------------------------------------------------------------------------

export interface PersistedRecState {
  active: boolean;
  startTs: number;
  points: Array<{ lat: number; lng: number; ele?: number; ts: number }>;
  lastPersist: number;
}

export function loadRecordingState(): PersistedRecState | null {
  return lsGet<PersistedRecState | null>(LS_KEYS.RECORDING, null);
}

export function saveRecordingState(state: PersistedRecState): void {
  lsSet(LS_KEYS.RECORDING, state);
}

export function clearRecordingState(): void {
  lsDel(LS_KEYS.RECORDING);
}

// ---------------------------------------------------------------------------
// LOCS Overrides (Quick access)
// ---------------------------------------------------------------------------

export async function loadLocsOverrides(): Promise<Record<string, LocsOverride>> {
  const all = await db.locsOverrides.toArray();
  const result: Record<string, LocsOverride> = {};
  for (const o of all) result[o.id] = o;
  return result;
}

export async function saveLocsOverride(id: string, override: Partial<LocsOverride>): Promise<void> {
  const existing = await db.locsOverrides.get(id) ?? { id };
  await db.locsOverrides.put({ ...existing, ...override, id });
}

export async function resetLocsOverride(id: string): Promise<void> {
  await db.locsOverrides.delete(id);
}

// ---------------------------------------------------------------------------
// Storage Info
// ---------------------------------------------------------------------------

export async function getStorageInfo(): Promise<{
  used: number;
  quota: number;
  persistent: boolean;
}> {
  try {
    const estimate = await navigator.storage?.estimate();
    const persistent = await navigator.storage?.persisted();
    return {
      used: estimate?.usage ?? 0,
      quota: estimate?.quota ?? 0,
      persistent: persistent ?? false,
    };
  } catch {
    return { used: 0, quota: 0, persistent: false };
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return await navigator.storage?.persist() ?? false;
  } catch {
    return false;
  }
}
