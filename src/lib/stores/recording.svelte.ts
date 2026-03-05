// =============================================================================
// GMTW Trail Map — Recording Store (Svelte 5 Runes)
//
// GPS Track Recording:
// - Start / Pause / Resume / Stop
// - Auto-Recovery: State alle 15s in LocalStorage persistieren
// - WakeLock während Aufnahme
// - GPX Export nach Aufnahme
// - Statistiken live berechnen
// =============================================================================

import { haversine, formatDist, formatDuration } from '$lib/services/geo';
import { buildGpxString } from '$lib/services/gpx';
import { saveRecordingState, loadRecordingState, clearRecordingState } from '$lib/services/storage';
import { tracksStore } from './tracks.svelte';
import { projectsStore } from './projects.svelte';
import { app } from './app.svelte';
import type { GpxPoint, TrackCat } from '$lib/types';

const PERSIST_INTERVAL_MS = 15000; // Auto-save every 15s

// ---------------------------------------------------------------------------
// RecordingStore class
// ---------------------------------------------------------------------------

class RecordingStore {
  active      = $state(false);
  paused      = $state(false);
  points      = $state<GpxPoint[]>([]);
  startTs     = $state(0);
  elapsed     = $state(0); // seconds
  distM       = $state(0);
  topSpeedKmh = $state(0);
  gpsErrors   = $state(0);
  name        = $state('Aufnahme');
  notes       = $state('');
  riderName   = $state('');
  muniName    = $state('');

  // Derived
  distFormatted    = $derived(formatDist(this.distM));
  elapsedFormatted = $derived(formatDuration(this.elapsed * 1000));
  pointCount       = $derived(this.points.length);

  private _watchId: number | null   = null;
  private _elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private _persistTimer: ReturnType<typeof setInterval> | null = null;
  private _wakeLock: WakeLockSentinel | null = null;
  private _prevLat   = 0;
  private _prevLng   = 0;
  private _prevTs    = 0;

  // ---------------------------------------------------------------------------
  // Auto-Recovery on Init
  // ---------------------------------------------------------------------------

  init(): void {
    const saved = loadRecordingState();
    if (saved?.active && saved.points.length > 0) {
      // Crashed recording — offer recovery
      this.points  = saved.points.map(p => ({ lat: p.lat, lng: p.lng, ele: p.ele, time: p.ts }));
      this.startTs = saved.startTs;
      this.elapsed = Math.floor((Date.now() - saved.startTs) / 1000);
      this._recalcStats();
      app.toast('Unterbrochene Aufnahme wiederhergestellt', 'info', 5000);
    }
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.active) return;
    if (!navigator.geolocation) {
      app.toast('GPS nicht verfügbar', 'error');
      return;
    }

    this.active      = true;
    this.paused      = false;
    this.points      = [];
    this.startTs     = Date.now();
    this.elapsed     = 0;
    this.distM       = 0;
    this.topSpeedKmh = 0;
    this.gpsErrors   = 0;
    this._prevTs     = 0;

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._onGps(pos),
      (err) => {
        this.gpsErrors++;
        console.warn('Recording GPS error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    this._startTimers();
    this._acquireWakeLock();
    app.toast('Aufnahme gestartet', 'success');
  }

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------

  togglePause(): void {
    if (!this.active) return;
    this.paused = !this.paused;
    app.toast(this.paused ? 'Aufnahme pausiert' : 'Aufnahme fortgesetzt', 'info');
  }

  // ---------------------------------------------------------------------------
  // Stop + Export
  // ---------------------------------------------------------------------------

  async stop(saveTrack = true): Promise<GpxPoint[] | null> {
    if (!this.active) return null;
    this.active = false;
    this.paused = false;
    this._stopTimers();
    this._releaseWakeLock();

    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }

    clearRecordingState();
    const points = [...this.points];

    if (saveTrack && points.length >= 3) {
      const gpx = buildGpxString(points, this.name, this.notes);
      const cat: TrackCat = 'custom';
      await tracksStore.loadGpxString(gpx, this.name, cat, projectsStore.activeProjectId ?? undefined);
      app.toast(`Track "${this.name}" gespeichert`, 'success');
    } else if (saveTrack) {
      app.toast('Zu wenige GPS-Punkte', 'warn');
    }

    // Reset state
    this.points  = [];
    this.elapsed = 0;
    this.distM   = 0;
    return points;
  }

  discard(): void {
    this.active = false;
    this.paused = false;
    this._stopTimers();
    this._releaseWakeLock();
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    clearRecordingState();
    this.points  = [];
    this.elapsed = 0;
    this.distM   = 0;
    app.toast('Aufnahme verworfen', 'info');
  }

  // ---------------------------------------------------------------------------
  // GPX Export (without saving to DB)
  // ---------------------------------------------------------------------------

  exportGpx(): string {
    return buildGpxString(this.points, this.name, this.notes);
  }

  // ---------------------------------------------------------------------------
  // GPS Handler
  // ---------------------------------------------------------------------------

  private _onGps(pos: GeolocationPosition): void {
    if (!this.active || this.paused) return;

    const { latitude: lat, longitude: lng, altitude: ele, speed } = pos.coords;
    const ts = pos.timestamp;

    const point: GpxPoint = {
      lat,
      lng,
      ele: ele ?? undefined,
      time: ts,
    };

    // Distance
    if (this._prevTs > 0) {
      const d = haversine({ lat: this._prevLat, lng: this._prevLng }, { lat, lng });
      this.distM += d;
    }
    this._prevLat = lat;
    this._prevLng = lng;
    this._prevTs  = ts;

    // Speed
    if (speed !== null && speed !== undefined) {
      const speedKmh = speed * 3.6;
      if (speedKmh > this.topSpeedKmh) this.topSpeedKmh = speedKmh;
    }

    this.points = [...this.points, point];
  }

  // ---------------------------------------------------------------------------
  // Timers
  // ---------------------------------------------------------------------------

  private _startTimers(): void {
    // Elapsed ticker (every second)
    this._elapsedTimer = setInterval(() => {
      if (this.active && !this.paused) this.elapsed++;
    }, 1000);

    // Auto-persist (every 15s)
    this._persistTimer = setInterval(() => {
      if (this.active) this._persistState();
    }, PERSIST_INTERVAL_MS);
  }

  private _stopTimers(): void {
    if (this._elapsedTimer)  { clearInterval(this._elapsedTimer);  this._elapsedTimer  = null; }
    if (this._persistTimer)  { clearInterval(this._persistTimer);  this._persistTimer  = null; }
  }

  private _persistState(): void {
    saveRecordingState({
      active:      this.active,
      startTs:     this.startTs,
      points:      this.points.map(p => ({ lat: p.lat, lng: p.lng, ele: p.ele, ts: p.time ?? Date.now() })),
      lastPersist: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // WakeLock
  // ---------------------------------------------------------------------------

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await (navigator as Navigator & {
          wakeLock: { request(type: string): Promise<WakeLockSentinel> }
        }).wakeLock.request('screen');
      }
    } catch { /* optional */ }
  }

  private _releaseWakeLock(): void {
    this._wakeLock?.release();
    this._wakeLock = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _recalcStats(): void {
    let dist = 0;
    for (let i = 1; i < this.points.length; i++) {
      dist += haversine(
        { lat: this.points[i - 1].lat, lng: this.points[i - 1].lng },
        { lat: this.points[i].lat, lng: this.points[i].lng }
      );
    }
    this.distM = dist;
  }
}

export const recordingStore = new RecordingStore();
