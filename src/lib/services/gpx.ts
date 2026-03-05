// =============================================================================
// GMTW Trail Map — GPX Parser, Builder und Validierung
// =============================================================================

import type { GpxData, GpxPoint, TrackBounds, TrackStats, TrackFeature } from '$lib/types';
import { haversine } from './geo';

// --- GPX Parser --------------------------------------------------------------

/** Parst GPX-XML-String in strukturierte GpxData */
export function parseGpx(gpxStr: string): GpxData {
  const sanitized = sanitizeGpx(gpxStr);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX: XML parse error');
  }

  // Name aus metadata/name oder trk/name
  const name =
    doc.querySelector('metadata > name')?.textContent?.trim() ||
    doc.querySelector('trk > name')?.textContent?.trim() ||
    doc.querySelector('rte > name')?.textContent?.trim() ||
    'Track';

  const desc =
    doc.querySelector('metadata > desc')?.textContent?.trim() ||
    doc.querySelector('trk > desc')?.textContent?.trim() || undefined;

  // Punkte aus trkpt oder rtept oder wpt
  const ptEls = Array.from(
    doc.querySelectorAll('trkpt, rtept, wpt')
  );

  const points: GpxPoint[] = ptEls
    .map((el): GpxPoint | null => {
      const lat = parseFloat(el.getAttribute('lat') ?? '');
      const lng = parseFloat(el.getAttribute('lon') ?? '');
      if (isNaN(lat) || isNaN(lng)) return null;
      const eleRaw = parseFloat(el.querySelector('ele')?.textContent ?? '');
      const timeStr = el.querySelector('time')?.textContent ?? '';
      return {
        lat,
        lng,
        ele: isNaN(eleRaw) ? undefined : eleRaw,
        time: timeStr ? new Date(timeStr).getTime() : undefined
      };
    })
    .filter((p): p is GpxPoint => p !== null);

  if (points.length < 2) {
    throw new Error('GPX enthält zu wenige Trackpunkte (< 2)');
  }

  const stats = calcStats(points);
  const bounds = calcBounds(points);

  return { points, name, desc, stats, bounds };
}

// --- Stats & Bounds ----------------------------------------------------------

export function calcStats(points: GpxPoint[]): TrackStats {
  let distKm = 0;
  let elevGain = 0;
  let elevLoss = 0;
  let maxElev = -Infinity;
  let minElev = Infinity;
  let durationMs = 0;

  for (let i = 1; i < points.length; i++) {
    distKm += haversine(points[i - 1], points[i]) / 1000;
    const e1 = points[i - 1].ele ?? 0;
    const e2 = points[i].ele ?? 0;
    const diff = e2 - e1;
    if (diff > 0) elevGain += diff;
    else elevLoss += Math.abs(diff);
    if (e2 > maxElev) maxElev = e2;
    if (e2 < minElev) minElev = e2;
  }

  if (points.length > 0 && points[0].ele !== undefined) {
    const e = points[0].ele ?? 0;
    if (e > maxElev) maxElev = e;
    if (e < minElev) minElev = e;
  }

  if (points[0]?.time && points[points.length - 1]?.time) {
    durationMs = (points[points.length - 1].time ?? 0) - (points[0].time ?? 0);
  }

  return {
    distKm: Math.round(distKm * 100) / 100,
    elevGain: Math.round(elevGain),
    elevLoss: Math.round(elevLoss),
    maxElev: maxElev === -Infinity ? 0 : Math.round(maxElev),
    minElev: minElev === Infinity ? 0 : Math.round(minElev),
    durationMs
  };
}

export function calcBounds(points: GpxPoint[]): TrackBounds {
  if (points.length === 0) return { north: 0, south: 0, east: 0, west: 0 };
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const p of points) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }
  return { north, south, east, west };
}

// --- GPX Builder -------------------------------------------------------------

/** Erzeugt gültigen GPX-XML-String aus Punkten */
export function buildGpxString(
  points: GpxPoint[],
  name: string,
  desc?: string
): string {
  const now = new Date().toISOString();
  const trkPts = points
    .map((p) => {
      const ele = p.ele !== undefined ? `\n      <ele>${p.ele.toFixed(1)}</ele>` : '';
      const time = p.time ? `\n      <time>${new Date(p.time).toISOString()}</time>` : '';
      return `    <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}${time}\n    </trkpt>`;
    })
    .join('\n');

  const descEl = desc ? `\n  <desc>${escXml(desc)}</desc>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GMTW Trail Map"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escXml(name)}</name>${descEl}
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escXml(name)}</name>
    <trkseg>
${trkPts}
    </trkseg>
  </trk>
</gpx>`;
}

// --- Feature-Injection in GPX -----------------------------------------------

/** Bettet Track-Features als GPX-Waypoints ein (für QR-Code-Export) */
export function injectFeaturesIntoGpx(
  gpxStr: string,
  features: TrackFeature[]
): string {
  if (!features || features.length === 0) return gpxStr;
  const wpts = features
    .map(
      (f) =>
        `<wpt lat="${f.lat.toFixed(6)}" lon="${f.lng.toFixed(6)}">\n` +
        `  <name>GMTW-FEAT:${f.type}:${f.diff}:${escXml(f.name)}</name>\n` +
        `</wpt>`
    )
    .join('\n');
  // Vor dem ersten <trk> einfügen
  return gpxStr.replace(/<trk>/, `${wpts}\n<trk>`);
}

/** Extrahiert Features aus GPX-Waypoints */
export function parseFeaturesFromGpx(gpxStr: string): TrackFeature[] {
  const features: TrackFeature[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxStr, 'application/xml');
  const wpts = doc.querySelectorAll('wpt');
  for (const wpt of wpts) {
    const nameEl = wpt.querySelector('name')?.textContent ?? '';
    if (!nameEl.startsWith('GMTW-FEAT:')) continue;
    const parts = nameEl.split(':');
    if (parts.length < 4) continue;
    const lat = parseFloat(wpt.getAttribute('lat') ?? '');
    const lng = parseFloat(wpt.getAttribute('lon') ?? '');
    if (isNaN(lat) || isNaN(lng)) continue;
    features.push({
      type: parts[1] as TrackFeature['type'],
      diff: parseInt(parts[2]) || 1,
      name: parts.slice(3).join(':'),
      lat,
      lng,
      date: Date.now()
    });
  }
  return features;
}

// --- XSS-Schutz -------------------------------------------------------------

/** Bereinigt GPX-String von potenziell schädlichem Inhalt */
export function sanitizeGpx(gpxStr: string): string {
  // Script-Tags und Event-Handler entfernen
  return gpxStr
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

/** XML-Sonderzeichen escapen */
export function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** HTML-Sonderzeichen escapen (für DOM-Injection-Schutz) */
export function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- GPX-Kategorie-Erkennung ------------------------------------------------

export function detectGpxCategory(gpxStr: string, name: string): string {
  const lower = (gpxStr + name).toLowerCase();
  if (lower.includes('expert')) return 'expert';
  if (lower.includes('mittel') || lower.includes('medium') || lower.includes('intermediate')) return 'mittel';
  if (lower.includes('beginner') || lower.includes('anfänger')) return 'beginner';
  if (lower.includes('logistik') || lower.includes('camp') || lower.includes('weg')) return 'optional-logistik';
  return 'custom';
}

// --- CORS-Proxy für GPX-URLs ------------------------------------------------

/** Fügt bei Bedarf einen CORS-Proxy vor eine URL */
export function proxyGpxUrl(url: string, useProxy: boolean): string {
  if (!useProxy) return url;
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}
