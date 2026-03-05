// =============================================================================
// GMTW Trail Map — Race Engine Store (Svelte 5 Runes)
//
// 6-State FSM: idle → approaching → at_line → go → racing → finished
//
// Features:
// - GPS Sensor-Fusion (Phone GPS + BLE Smartwatch GPS, Gewichtung 0.7/0.3)
// - Accelerometer Fall/Dismount Detection (35 m/s² Spike + 400ms Quiet)
// - Startlinie-Detektion (6m quer)
// - Checkpoint-Erkennung (4 gleichmäßige Sektoren)
// - HMAC-SHA256 Signatur für Race-Ergebnis
// - WakeLock für Display aktiv halten
// =============================================================================

import { haversine, computeCheckpoints, computeStartLine, lineCrossed, interpolateCrossTime, formatDuration } from '$lib/services/geo';
import { generateRaceSignature } from '$lib/services/crypto';
import { SmartWatchService } from '$lib/services/bluetooth';
import { db } from '$lib/services/database';
import { app } from './app.svelte';
import { mapStore } from './map.svelte';
import { tracksStore } from './tracks.svelte';
import type { RaceStateEnum, FallEvent, RunRecord, LatLng, GpxPoint } from '$lib/types';

// ---------------------------------------------------------------------------
// ACM / AVCM — Advanced Crash Metric (Ring-Buffer, Mehrphasen-Sturzerkennung)
// ---------------------------------------------------------------------------
// Phasen: normal → FREE_FALL (<2 m/s² für >=80ms) → IMPACT (>35 m/s²) → QUIET (<8 m/s² für >=400ms)
// AVCM   = Varianz im Impact-Fenster (bestätigt Sturz vs. Schlagloch)

const ACM_RING_SIZE        = 200;  // 4s @ 50Hz
const ACM_FF_THRESH        = 2.0;  // m/s² — freier Fall
const ACM_FF_MIN_MS        = 80;   // Mindest-Freifall-Dauer ms
const ACM_IMPACT_THRESH    = 35.0; // m/s² — Aufprall-Peak
const ACM_QUIET_THRESH     = 8.0;  // m/s² nach Aufprall
const ACM_QUIET_MS         = 400;  // ms stille nach Aufprall
const ACM_AVCM_MIN         = 12.0; // Mindest-Varianz im Impact-Fenster (nicht nur Schlagloch)
const FALL_COOLDOWN_MS     = 3000; // ms zwischen erkannten Stürzen

type AcmPhase = 'normal' | 'freefall' | 'impact' | 'quiet';

interface AcmSample { mag: number; ts: number; }

// ---------------------------------------------------------------------------
// RaceEngine class
// ---------------------------------------------------------------------------

class RaceEngine {
  // FSM State
  state        = $state<RaceStateEnum>('idle');
  trackId      = $state<string | null>(null);

  // Approach phase
  distToStart  = $state(Infinity);
  minDist      = $state(Infinity);
  armed        = $state(false);

  // Race phase
  startTs      = $state(0);
  elapsedMs    = $state(0); // live clock
  splits       = $state<number[]>([]);
  fallEvents   = $state<FallEvent[]>([]);
  nextCpIdx    = $state(0);
  checkpoints  = $state<LatLng[]>([]);

  // Start/Finish line (two points each)
  startLineA   = $state<LatLng | null>(null);
  startLineB   = $state<LatLng | null>(null);

  // Bluetooth GPS
  btConnected  = $state(false);
  btLat        = $state(0);
  btLng        = $state(0);
  btGpsFresh   = $state(false);

  // GPS
  lastLat      = $state(0);
  lastLng      = $state(0);
  lastGpsTs    = $state(0);
  lastSpeedKmh = $state(0);

  // Derived
  isApproaching = $derived(this.state === 'approaching' || this.state === 'at_line');
  isRacing      = $derived(this.state === 'racing' || this.state === 'go');
  isFinished    = $derived(this.state === 'finished');
  isNearStart   = $derived(this.distToStart < 5);
  canTrigger    = $derived(this.armed && this.distToStart > this.minDist + 1.5);
  currentSector = $derived(this.splits.length + 1);
  elapsedFormatted = $derived(formatDuration(this.elapsedMs));

  // Private
  private _elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private _trackPoints: GpxPoint[] = [];
  private _watchService = new SmartWatchService();
  private _wakeLock: WakeLockSentinel | null = null;
  private _lastFallTs = 0;
  private _prevLat = 0;
  private _prevLng = 0;
  private _prevGpsTs = 0;

  // ACM Ring-Buffer
  private _acmRing: AcmSample[] = [];
  private _acmPhase: AcmPhase = 'normal';
  private _acmPhaseStart = 0;    // ts when current phase started
  private _acmImpactPeak = 0;    // max magnitude during impact phase

  // ---------------------------------------------------------------------------
  // Setup (select track for race)
  // ---------------------------------------------------------------------------

  async setup(trackId: string): Promise<void> {
    const track = tracksStore.getTrack(trackId);
    if (!track) {
      app.toast('Track nicht gefunden', 'error');
      return;
    }
    this._trackPoints = tracksStore.getPointsForTrack(trackId);
    if (this._trackPoints.length < 10) {
      app.toast('Track zu kurz für Rennen', 'error');
      return;
    }

    this.trackId     = trackId;
    this.checkpoints = computeCheckpoints(this._trackPoints, 4);
    this.nextCpIdx   = 0;
    this.distToStart = Infinity;
    this.minDist     = Infinity;
    this.armed       = false;

    // Compute start line (perpendicular to first segment)
    if (this._trackPoints.length >= 2) {
      const [lineA, lineB] = computeStartLine(this._trackPoints[0], this._trackPoints[1]);
      this.startLineA = lineA;
      this.startLineB = lineB;
    }

    this.state = 'approaching';
    await this._acquireWakeLock();
  }

  // ---------------------------------------------------------------------------
  // Process GPS Position
  // ---------------------------------------------------------------------------

  processPosition(lat: number, lng: number, ts: number, accuracy: number): void {
    if (this.state === 'idle' || this.state === 'finished') return;

    // Sensor fusion with BLE GPS
    let fusedLat = lat;
    let fusedLng = lng;
    if (this.btGpsFresh && this.btConnected) {
      const w = _btGpsWeight(accuracy);
      fusedLat = lat * (1 - w) + this.btLat * w;
      fusedLng = lng * (1 - w) + this.btLng * w;
    }

    // Speed calculation
    if (this._prevGpsTs > 0) {
      const dt = (ts - this._prevGpsTs) / 1000;
      const distM = haversine({ lat: this._prevLat, lng: this._prevLng }, { lat: fusedLat, lng: fusedLng });
      this.lastSpeedKmh = dt > 0 ? (distM / dt) * 3.6 : 0;
    }
    this._prevLat   = fusedLat;
    this._prevLng   = fusedLng;
    this._prevGpsTs = ts;
    this.lastLat    = fusedLat;
    this.lastLng    = fusedLng;
    this.lastGpsTs  = ts;

    const pos: LatLng = { lat: fusedLat, lng: fusedLng };

    if (this.state === 'approaching' || this.state === 'at_line') {
      this._processApproaching(pos);
    } else if (this.state === 'go' || this.state === 'racing') {
      this._processRacing(pos, ts);
    }
  }

  private _processApproaching(pos: LatLng): void {
    if (!this._trackPoints.length) return;
    const start: LatLng = { lat: this._trackPoints[0].lat, lng: this._trackPoints[0].lng };
    const dist = haversine(pos, start); // meters
    this.distToStart = dist;

    if (dist < this.minDist) {
      this.minDist = dist;
    }

    if (dist <= 2) {
      this.state  = 'at_line';
      this.armed  = true;
    } else if (dist <= 10) {
      this.state = 'at_line';
      this.armed = false;
    } else {
      this.state = 'approaching';
    }

    // Auto-trigger when moving AWAY after being at_line and armed
    if (this.canTrigger) {
      this._startRace(Date.now());
    }
  }

  private _processRacing(pos: LatLng, ts: number): void {
    // Check checkpoints
    if (this.nextCpIdx < this.checkpoints.length) {
      const cp = this.checkpoints[this.nextCpIdx];
      const d  = haversine(pos, cp);
      if (d < 15) {
        const splitMs = ts - this.startTs - this.splits.reduce((a, b) => a + b, 0);
        this.splits   = [...this.splits, splitMs];
        this.nextCpIdx++;
        app.toast(`Sektor ${this.splits.length} — ${formatDuration(splitMs)}`, 'info', 2000);
      }
    }

    // Check finish line crossing
    if (this.nextCpIdx >= this.checkpoints.length && this.startLineA && this.startLineB) {
      const crossed = lineCrossed(
        { lat: this._prevLat, lng: this._prevLng },
        pos,
        this.startLineA,
        this.startLineB
      );
      if (crossed) {
        const crossTs = interpolateCrossTime(
          { lat: this._prevLat, lng: this._prevLng, ts: this._prevGpsTs },
          { ...pos, ts },
          this.startLineA,
          this.startLineB
        );
        this._finishRace(crossTs);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Race Control
  // ---------------------------------------------------------------------------

  arm(): void {
    this.armed = true;
  }

  private _startRace(ts: number): void {
    this.state   = 'racing';
    this.startTs = ts;
    this.splits  = [];
    this._startElapsedTimer();
    app.toast('Rennen gestartet!', 'success', 1500);
  }

  private async _finishRace(finishTs: number): Promise<void> {
    if (this.state !== 'racing') return;
    this.state = 'finished';
    this._stopElapsedTimer();

    const totalMs = finishTs - this.startTs;
    this.elapsedMs = totalMs;

    const run = await this._buildRunRecord(totalMs);
    await db.runs.put(run);

    app.toast(`Ziel! ${formatDuration(totalMs)}`, 'success', 5000);
    this._releaseWakeLock();
  }

  private async _buildRunRecord(totalMs: number): Promise<RunRecord> {
    const profile = JSON.parse(localStorage.getItem('gmtw_profile_v1') ?? '{}');
    const today   = new Date().toISOString().slice(0, 10);

    const run: RunRecord = {
      id:            `run_${Date.now()}`,
      trackId:       this.trackId ?? '',
      date:          today,
      totalMs,
      splits:        [...this.splits],
      fallEvents:    [...this.fallEvents],
      riderName:     profile.name ?? '',
      muniName:      profile.muniName ?? '',
      wheelSize:     profile.wheelSize ?? '24',
      seatClampColor: profile.seatClampColor ?? '',
      signature:     '',
    };

    try {
      run.signature = await generateRaceSignature(run, profile);
    } catch {
      // Signature optional — App works without it
    }
    return run;
  }

  // ---------------------------------------------------------------------------
  // Fall / Dismount Detection
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // ACM/AVCM — Mehrphasen-Sturzerkennung mit Ring-Buffer
  // ---------------------------------------------------------------------------

  processAccel(event: DeviceMotionEvent): void {
    if (this.state !== 'racing') return;

    // Nutze accelerationIncludingGravity wenn acceleration nicht verfügbar
    const acc = event.acceleration ?? event.accelerationIncludingGravity;
    if (!acc) return;

    const raw = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
    // Bei accelerationIncludingGravity: Gravitation (9.81) subtrahieren (Näherung)
    const mag = event.acceleration ? raw : Math.max(0, raw - 9.81);
    const now = Date.now();

    // ── Ring-Buffer befüllen ────────────────────────────────────────────────
    this._acmRing.push({ mag, ts: now });
    if (this._acmRing.length > ACM_RING_SIZE) this._acmRing.shift();

    // ── Cooldown: keinen Sturz innerhalb der Sperrzeit ─────────────────────
    if (now - this._lastFallTs < FALL_COOLDOWN_MS) return;

    // ── Phasen-Automat ──────────────────────────────────────────────────────
    const elapsed = now - this._acmPhaseStart;

    switch (this._acmPhase) {
      case 'normal':
        if (mag < ACM_FF_THRESH) {
          this._acmPhase = 'freefall';
          this._acmPhaseStart = now;
        }
        break;

      case 'freefall':
        if (mag > ACM_IMPACT_THRESH) {
          if (elapsed >= ACM_FF_MIN_MS) {
            // Echter Freifall (lang genug) → jetzt Impact
            this._acmPhase = 'impact';
            this._acmPhaseStart = now;
            this._acmImpactPeak = mag;
          } else {
            // Zu kurz → kein Freifall, zurück
            this._acmPhase = 'normal';
          }
        } else if (mag > ACM_QUIET_THRESH) {
          // Freifall unterbrochen (normales Fahren), zurücksetzen
          this._acmPhase = 'normal';
        }
        break;

      case 'impact':
        if (mag > this._acmImpactPeak) this._acmImpactPeak = mag;
        if (mag < ACM_QUIET_THRESH) {
          this._acmPhase = 'quiet';
          this._acmPhaseStart = now;
        } else if (elapsed > 500) {
          // Impact dauert zu lange → kein echter Sturz
          this._acmPhase = 'normal';
        }
        break;

      case 'quiet':
        if (mag > ACM_QUIET_THRESH) {
          // Stille unterbrochen
          this._acmPhase = 'normal';
        } else if (elapsed >= ACM_QUIET_MS) {
          // Stille bestätigt → AVCM-Check
          const avcm = _computeAvcm(this._acmRing);
          if (avcm >= ACM_AVCM_MIN || this._acmImpactPeak > 50) {
            // Sturz bestätigt
            this._lastFallTs = now;
            this.recordFall('fall');
          }
          // Absteiger: Freifall kurz, kleiner Peak, niedrige AVCM
          this._acmPhase = 'normal';
          this._acmImpactPeak = 0;
        }
        break;
    }
  }

  // Absteiger manuell oder via niedrig-Energie-Fall erkennen
  processAccelDismount(event: DeviceMotionEvent): void {
    if (this.state !== 'racing') return;
    const acc = event.acceleration ?? event.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
    const now = Date.now();
    // Absteiger: kurze Freifall-Phase + moderater Impact (10-35 m/s²) + Stille
    if (mag > 10 && mag <= ACM_IMPACT_THRESH && now - this._lastFallTs > FALL_COOLDOWN_MS) {
      // Prüfe ob kurz zuvor (<200ms) Freifall war
      const recent = this._acmRing.filter(s => now - s.ts < 200);
      const hadFF  = recent.some(s => s.mag < ACM_FF_THRESH);
      if (hadFF) {
        this._lastFallTs = now;
        this.recordFall('dismount');
      }
    }
  }

  recordFall(type: FallEvent['type']): void {
    const event: FallEvent = {
      type,
      ts:  Date.now() - this.startTs,
      lat: this.lastLat,
      lng: this.lastLng,
    };
    this.fallEvents = [...this.fallEvents, event];
    app.toast(type === 'fall' ? '⚠️ Sturz erkannt' : '⚠️ Absteiger', 'warn', 3000);
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  reset(): void {
    this._stopElapsedTimer();
    this._releaseWakeLock();
    this.state       = 'idle';
    this.trackId     = null;
    this.distToStart = Infinity;
    this.minDist     = Infinity;
    this.armed       = false;
    this.startTs     = 0;
    this.elapsedMs   = 0;
    this.splits      = [];
    this.fallEvents  = [];
    this.nextCpIdx   = 0;
    this.checkpoints = [];
    this._trackPoints = [];
    this._prevLat    = 0;
    this._prevLng    = 0;
    this._prevGpsTs  = 0;
  }

  // ---------------------------------------------------------------------------
  // Bluetooth GPS
  // ---------------------------------------------------------------------------

  async connectWatch(): Promise<void> {
    try {
      this._watchService.onGpsUpdate = (data) => {
        this.btLat     = data.lat;
        this.btLng     = data.lng;
        this.btGpsFresh = true;
        this.btConnected = true;
        // Feed into race engine
        this.processPosition(mapStore.gpsPos?.lat ?? data.lat, mapStore.gpsPos?.lng ?? data.lng, Date.now(), 10);
      };
      await this._watchService.connect();
      this.btConnected = true;
      app.toast('Smartwatch verbunden', 'success');
    } catch (err) {
      app.toast(`Bluetooth-Fehler: ${err}`, 'error');
    }
  }

  disconnectWatch(): void {
    this._watchService.disconnect();
    this.btConnected  = false;
    this.btGpsFresh   = false;
  }

  // ---------------------------------------------------------------------------
  // Elapsed Timer
  // ---------------------------------------------------------------------------

  private _startElapsedTimer(): void {
    this._stopElapsedTimer();
    this._elapsedTimer = setInterval(() => {
      if (this.state === 'racing') {
        this.elapsedMs = Date.now() - this.startTs;
      }
    }, 50);
  }

  private _stopElapsedTimer(): void {
    if (this._elapsedTimer) {
      clearInterval(this._elapsedTimer);
      this._elapsedTimer = null;
    }
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
  // Get finished run
  // ---------------------------------------------------------------------------

  async getLastRun(): Promise<RunRecord | null> {
    if (!this.trackId) return null;
    const runs = await db.runs.where('trackId').equals(this.trackId).toArray();
    if (runs.length === 0) return null;
    // Sort by id descending (id = 'run_<timestamp>') → neuester Run zuerst
    return runs.sort((a, b) => b.id.localeCompare(a.id))[0];
  }

  async getRunsForTrack(trackId: string): Promise<RunRecord[]> {
    return db.runs.where('trackId').equals(trackId).toArray();
  }
}

/** BLE GPS weight based on phone GPS accuracy */
function _btGpsWeight(phoneAccuracy: number): number {
  if (phoneAccuracy > 20) return 0.5;  // poor phone GPS, trust BLE more
  if (phoneAccuracy > 10) return 0.3;  // medium
  return 0.15;                          // good phone GPS, trust it more
}

/**
 * AVCM — Amplitude Variation Crash Metric
 * Berechnet die Standardabweichung der Beschleunigungsbeträge im Ring-Buffer.
 * Hohe AVCM = starke Variation = echte Sturzsequenz (nicht nur ein Schlagloch).
 */
function _computeAvcm(ring: AcmSample[]): number {
  if (ring.length < 10) return 0;
  const mags = ring.map(s => s.mag);
  const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
  const variance = mags.reduce((a, b) => a + (b - mean) ** 2, 0) / mags.length;
  return Math.sqrt(variance);
}

export const raceEngine = new RaceEngine();
