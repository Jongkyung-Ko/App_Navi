export type { MarkerPoint } from '../utils/mapMarkers';

export function buildMapHtml(
  lat: number,
  lng: number,
  jsKey: string | null,
  markers: import('../utils/mapMarkers').MarkerPoint[],
): string {
  const markerJson = JSON.stringify(markers);
  const key = jsKey ?? '';

  if (!key) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{margin:0;height:100%;width:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${lat}, ${lng}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker([${lat}, ${lng}]).addTo(map).bindPopup('내 위치');
    const markers = ${markerJson};
    markers.forEach(m => {
      L.circleMarker([m.lat, m.lng], {
        radius: m.radius || 8,
        color: m.strokeColor || '#c2410c',
        weight: 2,
        fillColor: m.fillColor || 'rgba(234,88,12,0.55)',
        fillOpacity: 1
      }).addTo(map).bindPopup(m.title || '');
    });
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html,body,#map{margin:0;height:100%;width:100%;}
    .spot{border-radius:50%;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.28);}
  </style>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    kakao.maps.load(function() {
      const center = new kakao.maps.LatLng(${lat}, ${lng});
      const map = new kakao.maps.Map(document.getElementById('map'), { center, level: 4 });
      new kakao.maps.Marker({ map, position: center, title: '내 위치' });
      const markers = ${markerJson};
      markers.forEach(function(m) {
        const size = Math.max(10, (m.radius || 8) * 2);
        const el = document.createElement('div');
        el.className = 'spot';
        el.title = m.title || '';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.marginLeft = (-size / 2) + 'px';
        el.style.marginTop = (-size / 2) + 'px';
        el.style.background = m.fillColor || 'rgba(234,88,12,0.55)';
        el.style.border = '2px solid ' + (m.strokeColor || 'rgba(194,65,12,0.9)');
        new kakao.maps.CustomOverlay({
          map: map,
          position: new kakao.maps.LatLng(m.lat, m.lng),
          content: el,
          xAnchor: 0,
          yAnchor: 0
        });
      });
    });
  </script>
</body>
</html>`;
}
