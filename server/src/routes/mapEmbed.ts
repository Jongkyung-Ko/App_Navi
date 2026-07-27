import type { Request, Response } from 'express';

interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
}

function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function buildMapPage(opts: {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers: MarkerPoint[];
}): string {
  const { lat, lng, jsKey, markers } = opts;
  const markerJson = JSON.stringify(markers);
  const key = jsKey ? escapeJs(jsKey) : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #e8eef4; }
    #fallback { display:none; position:absolute; left:8px; bottom:8px; z-index:999;
      background:rgba(26,35,50,.85); color:#fff; font:12px/1.4 sans-serif; padding:6px 8px; border-radius:6px; }
    #legend { position:absolute; right:8px; bottom:8px; z-index:999;
      background:rgba(255,255,255,.92); color:#1a2332; font:11px/1.35 sans-serif;
      padding:8px 10px; border-radius:8px; box-shadow:0 1px 6px rgba(0,0,0,.18); }
    #legend .row { display:flex; align-items:center; gap:6px; margin-top:3px; }
    #legend .dot { width:10px; height:10px; border-radius:50%; border:1px solid rgba(0,0,0,.2); flex:0 0 auto; }
    .spot {
      border-radius: 50%;
      box-sizing: border-box;
      box-shadow: 0 1px 4px rgba(0,0,0,.28);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="legend">
    <div style="font-weight:700;margin-bottom:2px">시세 · 거래량</div>
    <div class="row"><span class="dot" style="background:rgba(220,38,38,.55)"></span>Top10 고가</div>
    <div class="row"><span class="dot" style="background:rgba(234,88,12,.55)"></span>Top10 중위</div>
    <div class="row"><span class="dot" style="background:rgba(234,179,8,.55)"></span>Top10 저가·그 외</div>
    <div style="margin-top:4px;color:#5c6670">원 크기 = 거래량</div>
  </div>
  <div id="fallback"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const lat = ${lat};
    const lng = ${lng};
    const markers = ${markerJson};
    const kakaoKey = '${key}';
    let ready = false;

    function spotStyle(m) {
      return {
        radius: Number(m.radius) > 0 ? Number(m.radius) : 8,
        fillColor: m.fillColor || 'rgba(234,88,12,0.55)',
        strokeColor: m.strokeColor || 'rgba(194,65,12,0.9)',
        title: m.title || ''
      };
    }

    function showLeaflet(note) {
      if (ready) return;
      ready = true;
      const map = L.map('map').setView([lat, lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup('내 위치');
      markers.forEach(function(m) {
        const s = spotStyle(m);
        L.circleMarker([m.lat, m.lng], {
          radius: s.radius,
          color: s.strokeColor,
          weight: 2,
          fillColor: s.fillColor,
          fillOpacity: 1
        }).addTo(map).bindPopup(s.title);
      });
      if (note) {
        const el = document.getElementById('fallback');
        el.style.display = 'block';
        el.textContent = note;
      }
      setTimeout(function() { map.invalidateSize(); }, 100);
    }

    function addKakaoSpot(map, m) {
      const s = spotStyle(m);
      const size = Math.max(10, s.radius * 2);
      const el = document.createElement('div');
      el.className = 'spot';
      el.title = s.title;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.marginLeft = (-size / 2) + 'px';
      el.style.marginTop = (-size / 2) + 'px';
      el.style.background = s.fillColor;
      el.style.border = '2px solid ' + s.strokeColor;
      el.addEventListener('click', function() {
        const iw = new kakao.maps.InfoWindow({ content: '<div style="padding:6px 8px;font:12px sans-serif;">' + (s.title || '') + '</div>' });
        iw.open(map, new kakao.maps.LatLng(m.lat, m.lng));
        setTimeout(function() { iw.close(); }, 2800);
      });
      new kakao.maps.CustomOverlay({
        map: map,
        position: new kakao.maps.LatLng(m.lat, m.lng),
        content: el,
        xAnchor: 0,
        yAnchor: 0,
        zIndex: 3
      });
    }

    function showKakao() {
      const script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(kakaoKey) + '&autoload=false';
      script.onload = function() {
        if (!window.kakao || !kakao.maps) {
          showLeaflet('카카오맵 로드 실패 · OSM 표시');
          return;
        }
        kakao.maps.load(function() {
          if (ready) return;
          ready = true;
          const center = new kakao.maps.LatLng(lat, lng);
          const map = new kakao.maps.Map(document.getElementById('map'), { center: center, level: 4 });
          new kakao.maps.Marker({ map: map, position: center, title: '내 위치' });
          markers.forEach(function(m) { addKakaoSpot(map, m); });
        });
      };
      script.onerror = function() {
        showLeaflet('카카오맵 스크립트 오류 · OSM 표시');
      };
      document.head.appendChild(script);
      setTimeout(function() {
        if (!ready) showLeaflet('카카오맵 응답 없음 · OSM 표시');
      }, 3500);
    }

    if (kakaoKey) showKakao();
    else showLeaflet();
  </script>
</body>
</html>`;
}

export function mapEmbedHandler(req: Request, res: Response): void {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).send('lat and lng required');
    return;
  }

  let markers: MarkerPoint[] = [];
  if (typeof req.query.markers === 'string' && req.query.markers) {
    try {
      const parsed = JSON.parse(req.query.markers) as MarkerPoint[];
      if (Array.isArray(parsed)) {
        markers = parsed
          .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
          .slice(0, 20);
      }
    } catch {
      markers = [];
    }
  }

  const jsKey =
    process.env.KAKAO_JS_KEY && !process.env.KAKAO_JS_KEY.startsWith('your_')
      ? process.env.KAKAO_JS_KEY
      : null;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildMapPage({ lat, lng, jsKey, markers }));
}
