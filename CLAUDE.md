# GMTW Trail Map — Svelte 5 Migration

## Stack
- **Svelte 5** Runes (`$state`, `$derived`, `$effect`) — KEIN Options API, kein `$:`
- **TypeScript** strict, Pfade via `$lib/...`
- **SvelteKit** static adapter, `/gmtw-svelte` base path (GitHub Pages)
- **Dexie.js** (IndexedDB), **Leaflet 1.9.4**, **pako** (DEFLATE), **Turf.js**
- **vite-plugin-pwa** injectManifest → `self.__WB_MANIFEST` (KEIN `$service-worker` import!)

## Projektstruktur
```
src/
├── lib/
│   ├── components/
│   │   ├── map/        TopBar, FilterChips, MapFABs, MapView, GpsMarker
│   │   ├── gpx/        GpxPanel, TrackCard, TrackList, TrackSheet, ElevationProfile, RecordingPanel
│   │   ├── race/       RaceHUD, ApproachOverlay, RaceTimer, ResultCard
│   │   ├── navigation/ NavHUD
│   │   ├── markers/    MarkerModal
│   │   ├── projects/   NewProjectModal, ProjectDropdown
│   │   ├── qr/         QRDisplay, QRScanner, QRShareModal
│   │   ├── settings/   SettingsPanel + tabs/
│   │   ├── features/   FeatPosPickerModal, FeaturesPanel
│   │   └── ui/         Toast, Modal, BottomSheet, A11yFab, PwaInstallBanner
│   ├── stores/         *.svelte.ts (Runes-Klassen, singleton export)
│   ├── services/       geo.ts, gpx.ts, qr-engine.ts, crypto.ts, database.ts, ...
│   ├── data/           locs.ts (DEFAULT_CENTER:[51.4192,7.4855]), translations.ts
│   └── types/          index.ts
├── routes/             +layout.svelte, +page.svelte
└── service-worker.ts
```

## Kritische Muster

### Stores (immer Klassen-Singleton)
```ts
class FooStore {
  val = $state(0);
  derived = $derived(this.val * 2);
  update() { this.val++; }
}
export const fooStore = new FooStore();
```

### Haversine gibt METER zurück (R=6371000)
`haversine({lat,lng},{lat,lng})` → Meter. KEIN `* 1000` nötig!

### Leaflet nur client-side
```ts
const L = await import('leaflet'); // dynamic import in onMount/$effect
```

### PWA Service Worker
`declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: ... };`

## Design System (CSS-Variablen)
`--bg --s1 --s2 --s3 --ac(#c8ff00) --acd --tx --td --bd --bd2 --r --fh --shadow`
Font: Barlow Condensed (`var(--fh)`), Barlow (`var(--fb)`)
Theme: `[data-theme="dark"|"light"]` auf `<html>`

## GitHub GPX
`https://raw.githubusercontent.com/Munimap/munimap.github.io/main/gpx/`
6 AUTO_TRACKS in `tracks.svelte.ts` — auto-download beim ersten Start

## Build
```bash
npm run build   # .svelte-kit/output/ → build/
npm run dev     # localhost:5173
```
CI: `.github/workflows/deploy.yml` → GitHub Pages push

## DO NOT
- Kein `import from '$service-worker'`
- Kein `$:` reaktive Anweisung (Svelte 4 Syntax)
- Kein `createEventDispatcher` → stattdessen Props: `onclose: () => void`
- Kein `writable/readable` Stores → Runes-Klassen
- Kein `haversine(...) * 1000` (gibt bereits Meter)
