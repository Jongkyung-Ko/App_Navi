export interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
}

export function buildMapHtml(
  lat: number,
  lng: number,
  jsKey: string | null,
  markers: MarkerPoint[],
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
      L.circleMarker([m.lat, m.lng], { radius: 7, color: '#c45c26', fillColor: '#e07a3d', fillOpacity: 0.9 })
        .addTo(map).bindPopup(m.title || '');
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
  <style>html,body,#map{margin:0;height:100%;width:100%;}</style>
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
        const pos = new kakao.maps.LatLng(m.lat, m.lng);
        new kakao.maps.Marker({ map, position: pos, title: m.title || '' });
      });
    });
  </script>
</body>
</html>`;
}
