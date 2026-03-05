<script lang="ts">
  import { mapStore } from '$lib/stores/map.svelte';
  import { app } from '$lib/stores/app.svelte';

  let marker: import('leaflet').Marker | null = null;
  let accuracyCircle: import('leaflet').Circle | null = null;

  function calcSize(zoom: number): number {
    return Math.max(20, Math.min(48, 16 + zoom * 1.2));
  }

  $effect(() => {
    const pos = mapStore.gpsPos;
    const m = mapStore.map;
    if (!m) return;

    (async () => {
      const L = await import('leaflet');
      if (!pos) {
        if (marker) { m.removeLayer(marker); marker = null; }
        if (accuracyCircle) { m.removeLayer(accuracyCircle); accuracyCircle = null; }
        return;
      }

      const zoom = m.getZoom();
      const size = calcSize(zoom);
      const emoji = app.gpsEmoji;

      const icon = L.divIcon({
        className: 'gps-marker',
        html: `<span style="font-size:${size * 0.7}px;line-height:1;display:block;text-align:center;filter:drop-shadow(0 0 4px rgba(200,255,0,0.7))">${emoji}</span>`,
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      if (marker) {
        marker.setLatLng([pos.lat, pos.lng]);
        marker.setIcon(icon);
      } else {
        marker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 1000 }).addTo(m);
      }

      // Accuracy circle
      if (mapStore.gpsAccuracy > 0) {
        if (accuracyCircle) {
          accuracyCircle.setLatLng([pos.lat, pos.lng]);
          accuracyCircle.setRadius(mapStore.gpsAccuracy);
        } else {
          accuracyCircle = L.circle([pos.lat, pos.lng], {
            radius: mapStore.gpsAccuracy,
            color: '#c8ff00',
            weight: 1,
            opacity: 0.5,
            fillColor: '#c8ff00',
            fillOpacity: 0.08,
          }).addTo(m);
        }
      }
    })();
  });
</script>
