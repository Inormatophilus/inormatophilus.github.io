// =============================================================================
// GMTW Trail Map — Text-to-Speech Engine (Web Speech API)
//
// Features:
// - Queue-basiertes Sprechen (FIFO)
// - Chrome 15s-Bugfix: resume() Keepalive alle 10s
// - Sprachauswahl: de-DE bevorzugt, Fallback auf andere de-Stimmen
// - Rate-Steuerung (0.5–2.0)
// - Interrupt-Modus (aktuelle Ausgabe abbrechen und sofort sprechen)
// =============================================================================

export class TTSEngine {
  private queue: string[] = [];
  private speaking = false;
  private voices: SpeechSynthesisVoice[] = [];
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  rate = 1.0;
  lang = 'de-DE';
  lastText = '';
  paused = false;

  onStateChange?: (state: 'idle' | 'speaking' | 'paused') => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadVoices();
      window.speechSynthesis?.addEventListener('voiceschanged', () => this.loadVoices());
    }
  }

  // --- Voice Loading ----------------------------------------------------------

  loadVoices(): void {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    if (voices.length > 0) {
      this.voices = voices;
    }
  }

  /** Gibt bevorzugte Offline-Stimme zurück (localService === true) */
  private getBestVoice(): SpeechSynthesisVoice | null {
    const langCode = this.lang.split('-')[0]; // 'de' aus 'de-DE'
    // Priorisierung: exakter Match → Sprachcode-Match → Fallback
    return (
      this.voices.find((v) => v.lang === this.lang && v.localService) ||
      this.voices.find((v) => v.lang.startsWith(langCode) && v.localService) ||
      this.voices.find((v) => v.lang === this.lang) ||
      this.voices.find((v) => v.lang.startsWith(langCode)) ||
      null
    );
  }

  // --- Queue Management -------------------------------------------------------

  /**
   * Fügt Text zur Sprachqueue hinzu.
   * @param interrupt Wenn true: aktuelle Ausgabe sofort abbrechen
   */
  speak(text: string, interrupt = false): void {
    if (!window.speechSynthesis) return;
    const cleaned = this.cleanForSpeech(text);
    if (!cleaned) return;

    if (interrupt) {
      this.queue = [cleaned];
      window.speechSynthesis.cancel();
      this.speaking = false;
      // Chrome braucht kurze Pause nach cancel()
      setTimeout(() => this.flush(), 80);
    } else {
      this.queue.push(cleaned);
      if (!this.speaking) this.flush();
    }
  }

  /** Synchrones Flush: nächstes Element aus Queue sprechen */
  flush(): void {
    if (!window.speechSynthesis || this.speaking || this.queue.length === 0) return;
    const text = this.queue.shift()!;
    this.lastText = text;

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = this.lang;
    utt.rate = this.rate;
    const voice = this.getBestVoice();
    if (voice) utt.voice = voice;

    utt.onstart = () => {
      this.speaking = true;
      this.paused = false;
      this.startKeepAlive();
      this.onStateChange?.('speaking');
    };

    utt.onend = () => {
      this.speaking = false;
      this.currentUtterance = null;
      this.onStateChange?.(this.queue.length > 0 ? 'speaking' : 'idle');
      // Nächstes Element sprechen
      if (this.queue.length > 0) {
        setTimeout(() => this.flush(), 50);
      } else {
        this.stopKeepAlive();
      }
    };

    utt.onerror = (e) => {
      // 'canceled' ist kein echter Fehler (passiert bei cancel())
      if (e.error === 'canceled') return;
      this.speaking = false;
      this.currentUtterance = null;
      this.stopKeepAlive();
      this.onStateChange?.('idle');
      // Bei Fehler: nächstes Element versuchen
      if (this.queue.length > 0) setTimeout(() => this.flush(), 100);
    };

    this.currentUtterance = utt;
    window.speechSynthesis.speak(utt);
  }

  /** Stoppt alle Ausgaben und leert Queue */
  stop(): void {
    this.queue = [];
    window.speechSynthesis?.cancel();
    this.speaking = false;
    this.paused = false;
    this.currentUtterance = null;
    this.stopKeepAlive();
    this.onStateChange?.('idle');
  }

  /** Wiederholt letzte Ausgabe */
  repeat(): void {
    if (this.lastText) this.speak(this.lastText, true);
  }

  /** Überspringt aktuelle Ausgabe, spielt nächste */
  skipForward(): void {
    if (this.queue.length > 0) {
      window.speechSynthesis?.cancel();
      this.speaking = false;
      setTimeout(() => this.flush(), 80);
    }
  }

  /** Toggle Pause/Weiter */
  togglePause(): void {
    if (!window.speechSynthesis) return;
    if (this.paused) {
      window.speechSynthesis.resume();
      this.paused = false;
      this.onStateChange?.('speaking');
    } else {
      window.speechSynthesis.pause();
      this.paused = true;
      this.onStateChange?.('paused');
    }
  }

  // --- Chrome 15s Keepalive Bug-Fix -------------------------------------------

  /**
   * Chrome pausiert speechSynthesis nach ~15 Sekunden inaktivem Tab.
   * Workaround: resume() alle 10 Sekunden aufrufen.
   */
  private startKeepAlive(): void {
    if (this.keepAliveTimer) return;
    this.keepAliveTimer = setInterval(() => {
      if (this.speaking && !this.paused) {
        window.speechSynthesis?.resume();
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // --- Text-Bereinigung -------------------------------------------------------

  /** Bereinigt Text für Sprachausgabe (Emojis, Sonderzeichen) */
  cleanForSpeech(text: string): string {
    return text
      // Emojis entfernen (breite Zeichen)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Sonderzeichen
      .replace(/[★☆✓✗⚠]/g, '')
      // Mehrfache Leerzeichen
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- Sprache ändern ---------------------------------------------------------

  setLang(lang: string): void {
    this.lang = lang === 'de' ? 'de-DE' :
                lang === 'en' ? 'en-US' :
                lang === 'fr' ? 'fr-FR' :
                lang === 'es' ? 'es-ES' :
                lang === 'it' ? 'it-IT' : 'de-DE';
    this.loadVoices();
  }

  // --- Status -----------------------------------------------------------------

  get isActive(): boolean { return this.speaking || this.queue.length > 0; }
  get queueLength(): number { return this.queue.length; }
}

/** Singleton TTS-Engine */
export const tts = new TTSEngine();
