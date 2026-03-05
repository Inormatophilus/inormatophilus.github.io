// =============================================================================
// GMTW Trail Map — Accessibility Store (Svelte 5 Runes)
//
// Features:
// - TTS Queue (Web Speech API via TTSEngine)
// - High-Contrast Modus
// - ARIA Live Region Announcements
// - Keyboard Shortcuts (V/N/S/G/Esc)
// - Auto-Announce bei State-Änderungen
// =============================================================================

import { tts } from '$lib/services/tts';
import { loadA11y, saveA11y } from '$lib/services/storage';
import { app } from './app.svelte';
import { mapStore } from './map.svelte';
import { tracksStore } from './tracks.svelte';
import { markersStore } from './markers.svelte';
import type { A11ySettings } from '$lib/types';

// ---------------------------------------------------------------------------
// A11yStore class
// ---------------------------------------------------------------------------

class A11yStore {
  enabled      = $state(false);
  rate         = $state(1.0);
  hc           = $state(false);  // high contrast
  autoAnnounce = $state(true);
  ttsActive    = $state(false);  // currently speaking

  // Derived
  isActive = $derived(this.enabled);

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  init(): void {
    const saved = loadA11y();
    this.enabled      = saved.enabled;
    this.rate         = saved.rate;
    this.hc           = saved.hc;
    this.autoAnnounce = saved.autoAnnounce;

    tts.rate = this.rate;
    tts.onStateChange = (state) => {
      this.ttsActive = state === 'speaking';
    };

    if (this.hc) this._applyHc(true);

    // Keyboard shortcuts
    this._initKeyboardShortcuts();
  }

  // ---------------------------------------------------------------------------
  // Setters (persist to LS)
  // ---------------------------------------------------------------------------

  toggle(): void {
    this.enabled = !this.enabled;
    this._save();
    if (!this.enabled) tts.stop();
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
    tts.rate  = this.rate;
    this._save();
  }

  toggleHc(): void {
    this.hc = !this.hc;
    this._applyHc(this.hc);
    this._save();
  }

  setAutoAnnounce(val: boolean): void {
    this.autoAnnounce = val;
    this._save();
  }

  private _save(): void {
    saveA11y({
      enabled:      this.enabled,
      rate:         this.rate,
      hc:           this.hc,
      autoAnnounce: this.autoAnnounce,
    });
  }

  private _applyHc(active: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.a11yHc = active ? 'true' : '';
  }

  // ---------------------------------------------------------------------------
  // TTS
  // ---------------------------------------------------------------------------

  speak(text: string, interrupt = false): void {
    if (!this.enabled) return;
    tts.speak(text, interrupt);
  }

  speakAlways(text: string, interrupt = false): void {
    // speaks regardless of enabled state (e.g. for direct user requests)
    tts.speak(text, interrupt);
  }

  stop(): void {
    tts.stop();
  }

  repeat(): void {
    tts.repeat();
  }

  toggleSpeaking(): void {
    tts.togglePause();
  }

  // ---------------------------------------------------------------------------
  // Contextual Announcements
  // ---------------------------------------------------------------------------

  speakMapOverview(): void {
    if (!mapStore.map) return;
    const c     = mapStore.map.getCenter();
    const zoom  = mapStore.map.getZoom();
    const tracks = tracksStore.visibleTracks;
    const msg = `${app.t('map_overview', {
      lat: c.lat.toFixed(3),
      lng: c.lng.toFixed(3),
      zoom: String(zoom),
      count: String(tracks.length),
    })}`;
    this.speakAlways(msg, true);
  }

  speakNearestPoint(): void {
    if (!mapStore.gpsPos) {
      this.speakAlways(app.t('no_gps'), true);
      return;
    }
    const pos = mapStore.gpsPos;

    // Find nearest LOCS marker
    let nearest = '';
    let minDist = Infinity;
    for (const loc of markersStore.visibleLocs) {
      const d = Math.hypot(loc.lat - pos.lat, loc.lng - pos.lng);
      if (d < minDist) {
        minDist  = d;
        const name = loc.nameI18n?.[app.lang] ?? loc.name;
        nearest = name;
      }
    }

    if (nearest) {
      this.speakAlways(`${app.t('nearest_point')}: ${nearest}`, true);
    } else {
      this.speakAlways(app.t('no_nearby'), true);
    }
  }

  // ---------------------------------------------------------------------------
  // ARIA Live Region
  // ---------------------------------------------------------------------------

  ariaAnnounce(msg: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (typeof document === 'undefined') return;
    const id  = priority === 'polite' ? 'a11y-live-polite' : 'a11y-live-assertive';
    const el  = document.getElementById(id);
    if (!el) return;
    // Clear then set (ensures re-read)
    el.textContent = '';
    requestAnimationFrame(() => {
      el.textContent = msg;
    });
  }

  // ---------------------------------------------------------------------------
  // Keyboard Shortcuts
  // ---------------------------------------------------------------------------

  private _initKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      // Don't trigger when focus is in an input
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      switch (e.key.toUpperCase()) {
        case 'V': this.speakMapOverview(); break;
        case 'N': this.speakNearestPoint(); break;
        case 'S': app.openSettings(); break;
        case 'G': mapStore.toggleGps(); break;
        case 'ESCAPE': {
          if (app.settingsOpen) app.closeSettings();
          break;
        }
      }
    });
  }
}

export const a11yStore = new A11yStore();
