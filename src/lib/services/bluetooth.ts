// =============================================================================
// GMTW Trail Map — Web Bluetooth API (Smartwatch GPS + Sensorfusion)
//
// Verbindet sich mit BLE-Geräten (Garmin, Apple Watch, Bangle.js, Polar).
// GATT-Services:
// - Location & Navigation Service: UUID 0x1819 (GPS-Koordinaten)
// - Heart Rate Service: UUID 0x180D (Herzfrequenz)
//
// Sensorfusion: Smartwatch-GPS wird gewichtet mit Smartphone-GPS kombiniert,
// um bessere Positionsgenauigkeit im Waldgelände zu erreichen.
// =============================================================================

export interface WatchGpsData {
  lat: number;
  lng: number;
  accuracy?: number;
  ts: number; // unix ms
}

export interface WatchHeartRateData {
  bpm: number;
  ts: number;
}

export type WatchConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * SmartWatchService — Verwaltet BLE-Verbindung zu einer Smartwatch.
 * Liefert GPS-Koordinaten und Herzfrequenz-Daten.
 */
export class SmartWatchService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private gpsChar: BluetoothRemoteGATTCharacteristic | null = null;
  private hrChar: BluetoothRemoteGATTCharacteristic | null = null;

  connectionState: WatchConnectionState = 'disconnected';
  lastGps: WatchGpsData | null = null;
  lastHr: WatchHeartRateData | null = null;

  // Callbacks
  onGpsUpdate?: (data: WatchGpsData) => void;
  onHrUpdate?: (data: WatchHeartRateData) => void;
  onStateChange?: (state: WatchConnectionState) => void;
  onDisconnect?: () => void;

  get isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  get gpsFresh(): boolean {
    if (!this.lastGps) return false;
    return Date.now() - this.lastGps.ts < 3000;
  }

  /**
   * Verbindet mit Smartwatch via Web Bluetooth API.
   * Sucht nach GPS (0x1819) oder HR (0x180D) Services.
   */
  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth API nicht verfügbar');
    }
    this.setState('connecting');
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          0x1819, // Location & Navigation
          0x180D, // Heart Rate
          0x180F, // Battery
        ]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      this.server = await this.device.gatt!.connect();
      await this.setupServices();
      this.setState('connected');
    } catch (e) {
      this.setState('error');
      throw e;
    }
  }

  private async setupServices(): Promise<void> {
    if (!this.server) return;

    // GPS Service (Location & Navigation)
    try {
      const gpsService = await this.server.getPrimaryService(0x1819);
      // Location & Speed Characteristic
      this.gpsChar = await gpsService.getCharacteristic(0x2A67);
      await this.gpsChar.startNotifications();
      this.gpsChar.addEventListener('characteristicvaluechanged', (e) => {
        this.handleGpsData(e.target as BluetoothRemoteGATTCharacteristic);
      });
    } catch {
      // GPS Service nicht verfügbar — kein Fehler
    }

    // Heart Rate Service
    try {
      const hrService = await this.server.getPrimaryService(0x180D);
      this.hrChar = await hrService.getCharacteristic(0x2A37);
      await this.hrChar.startNotifications();
      this.hrChar.addEventListener('characteristicvaluechanged', (e) => {
        this.handleHrData(e.target as BluetoothRemoteGATTCharacteristic);
      });
    } catch {
      // HR Service nicht verfügbar — kein Fehler
    }
  }

  /**
   * Parst GATT Location & Speed Characteristic (0x2A67).
   * Flags-Byte bestimmt welche Felder vorhanden sind.
   */
  private handleGpsData(char: BluetoothRemoteGATTCharacteristic): void {
    const view = char.value;
    if (!view || view.byteLength < 5) return;
    try {
      // Flags (2 bytes)
      const flags = view.getUint16(0, true);
      let offset = 2;
      // Latitude & Longitude (je 4 bytes, sint32, ×1e-7 Grad)
      if (view.byteLength >= offset + 8) {
        const lat = view.getInt32(offset, true) / 1e7;
        const lng = view.getInt32(offset + 4, true) / 1e7;
        offset += 8;
        if (isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0) {
          this.lastGps = { lat, lng, ts: Date.now() };
          this.onGpsUpdate?.(this.lastGps);
        }
      }
      void flags;
    } catch {
      // Parse-Fehler ignorieren
    }
  }

  /**
   * Parst Heart Rate Measurement Characteristic (0x2A37).
   */
  private handleHrData(char: BluetoothRemoteGATTCharacteristic): void {
    const view = char.value;
    if (!view || view.byteLength < 2) return;
    try {
      const flags = view.getUint8(0);
      const bpm = flags & 0x1
        ? view.getUint16(1, true)  // 16-bit HR
        : view.getUint8(1);        // 8-bit HR
      this.lastHr = { bpm, ts: Date.now() };
      this.onHrUpdate?.(this.lastHr);
    } catch {
      // Parse-Fehler ignorieren
    }
  }

  /** Trennt Verbindung zur Smartwatch */
  disconnect(): void {
    if (this.gpsChar) {
      this.gpsChar.stopNotifications().catch(() => {});
    }
    if (this.hrChar) {
      this.hrChar.stopNotifications().catch(() => {});
    }
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnect();
  }

  private handleDisconnect(): void {
    this.server = null;
    this.gpsChar = null;
    this.hrChar = null;
    this.lastGps = null;
    this.setState('disconnected');
    this.onDisconnect?.();
  }

  private setState(state: WatchConnectionState): void {
    this.connectionState = state;
    this.onStateChange?.(state);
  }

  get deviceName(): string {
    return this.device?.name ?? 'Unbekanntes Gerät';
  }
}

/**
 * Sensorfusion: Kombiniert Phone-GPS und Watch-GPS.
 * Gewichtete Interpolation: Watch-GPS bevorzugt wenn fresh (<3s alt).
 */
export function fuseGpsPositions(
  phoneLat: number, phoneLng: number,
  watchGps: WatchGpsData | null,
  watchWeight = 0.7
): { lat: number; lng: number; source: 'phone' | 'watch' | 'fused' } {
  if (!watchGps || Date.now() - watchGps.ts > 3000) {
    return { lat: phoneLat, lng: phoneLng, source: 'phone' };
  }
  if (phoneLat === 0 && phoneLng === 0) {
    return { lat: watchGps.lat, lng: watchGps.lng, source: 'watch' };
  }
  // Gewichtete Fusion
  const lat = phoneLat * (1 - watchWeight) + watchGps.lat * watchWeight;
  const lng = phoneLng * (1 - watchWeight) + watchGps.lng * watchWeight;
  return { lat, lng, source: 'fused' };
}

/** Prüft ob Web Bluetooth verfügbar ist */
export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
