import type { Request, Response } from 'express';

interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
  priceLabel?: string;
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
    #fallback { display:none; position:absolute; left:50%; bottom:10px; transform:translateX(-50%);
      z-index:999; max-width:70%; text-align:center;
      background:rgba(26,35,50,.85); color:#fff; font:11px/1.35 sans-serif; padding:5px 8px; border-radius:6px; }
    #legend { position:absolute; right:8px; bottom:10px; z-index:999; max-width:42%;
      background:rgba(255,255,255,.94); color:#1a2332; font:10px/1.3 sans-serif;
      padding:6px 8px; border-radius:8px; box-shadow:0 1px 6px rgba(0,0,0,.18); }
    #legend .row { display:flex; align-items:center; gap:5px; margin-top:2px; }
    #legend .dot { width:9px; height:9px; border-radius:50%; border:1px solid rgba(0,0,0,.2); flex:0 0 auto; }
    #hint { position:absolute; left:50%; bottom:52px; top:auto; transform:translateX(-50%); z-index:999;
      max-width:min(240px, 62%); text-align:center;
      background:rgba(255,255,255,.94); color:#5c6670; font:11px/1.35 sans-serif;
      padding:5px 10px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,.12); pointer-events:none; }
    .leaflet-bottom.leaflet-right { margin-bottom: 4px; }
    .spot-icon { background: transparent !important; border: none !important; }
    .me-icon { background: transparent !important; border: none !important; }
    .spot-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      pointer-events: auto;
    }
    .spot {
      border-radius: 50%;
      box-sizing: border-box;
      box-shadow: 0 1px 4px rgba(0,0,0,.28);
      border: 2px solid rgba(0,0,0,.2);
      flex: 0 0 auto;
    }
    .spot-label {
      margin-top: 2px;
      padding: 1px 5px;
      border-radius: 999px;
      background: rgba(255,255,255,.94);
      color: #1a2332;
      font: 700 10px/1.2 sans-serif;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,.18);
      max-width: 72px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .me-wrap {
      width: 22px;
      height: 22px;
      position: relative;
    }
    .me-pulse {
      position: absolute;
      left: 0; top: 0; right: 0; bottom: 0;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.28);
      animation: mePulse 1.8s ease-out infinite;
    }
    .me-dot {
      position: absolute;
      left: 5px; top: 5px;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #2563eb;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.35);
    }
    @keyframes mePulse {
      0% { transform: scale(0.55); opacity: 0.9; }
      70% { transform: scale(1.35); opacity: 0; }
      100% { transform: scale(1.35); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="hint">길게 누르면 이 위치로 시세 조사</div>
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
    let markers = ${markerJson};
    const kakaoKey = '${key}';
    let ready = false;
    let programmatic = false;
    let mapApi = null;

    function emit(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (e) {}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      } catch (e) {}
    }

    function emitLongPress(plat, plng) {
      emit({ type: 'appnavi:map-longpress', lat: plat, lng: plng });
    }

    function emitInteract() {
      if (programmatic) return;
      emit({ type: 'appnavi:map-interact' });
    }

    function emitReady() {
      emit({ type: 'appnavi:map-ready' });
    }

    function withProgrammatic(fn) {
      programmatic = true;
      try { fn(); } finally {
        setTimeout(function() { programmatic = false; }, 80);
      }
    }

    function meHtml() {
      return '<div class="me-wrap"><div class="me-pulse"></div><div class="me-dot"></div></div>';
    }

    function bindDomLongPress(getLatLng) {
      const el = document.getElementById('map');
      let timer = null;
      let startX = 0;
      let startY = 0;
      const clear = function() {
        if (timer) { clearTimeout(timer); timer = null; }
      };
      const start = function(clientX, clientY) {
        clear();
        startX = clientX;
        startY = clientY;
        timer = setTimeout(function() {
          timer = null;
          const ll = getLatLng(clientX, clientY);
          if (ll) emitLongPress(ll.lat, ll.lng);
        }, 550);
      };
      el.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches[0]) return;
        start(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      el.addEventListener('touchmove', function(e) {
        if (!e.touches || !e.touches[0] || !timer) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (dx * dx + dy * dy > 100) clear();
      }, { passive: true });
      el.addEventListener('touchend', clear);
      el.addEventListener('touchcancel', clear);
      el.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        start(e.clientX, e.clientY);
      });
      el.addEventListener('mousemove', function(e) {
        if (!timer) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy > 100) clear();
      });
      el.addEventListener('mouseup', clear);
      el.addEventListener('mouseleave', clear);
      el.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        const ll = getLatLng(e.clientX, e.clientY);
        if (ll) emitLongPress(ll.lat, ll.lng);
      });
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function spotStyle(m) {
      return {
        radius: Number(m.radius) > 0 ? Number(m.radius) : 10,
        fillColor: m.fillColor || 'rgba(234,88,12,0.55)',
        strokeColor: m.strokeColor || 'rgba(194,65,12,0.9)',
        title: m.title || '',
        priceLabel: m.priceLabel || ''
      };
    }

    function spotHtml(m) {
      const s = spotStyle(m);
      const size = Math.max(20, s.radius * 2);
      const label = escapeHtml(s.priceLabel);
      return '<div class="spot-wrap">'
        + '<div class="spot" style="width:' + size + 'px;height:' + size + 'px;'
        + 'background:' + s.fillColor + ';border-color:' + s.strokeColor + '"></div>'
        + (label ? '<div class="spot-label">' + label + '</div>' : '')
        + '</div>';
    }

    function onHostMessage(event) {
      const data = event && event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'appnavi:map-cmd' || !mapApi) return;
      const cmd = data.cmd;
      if (cmd === 'setUserLocation') {
        mapApi.setUserLocation(Number(data.lat), Number(data.lng), !!data.center);
      } else if (cmd === 'setCenter') {
        mapApi.setCenter(Number(data.lat), Number(data.lng));
      } else if (cmd === 'setFocus') {
        mapApi.setFocus(
          data.lat == null ? null : Number(data.lat),
          data.lng == null ? null : Number(data.lng)
        );
      } else if (cmd === 'setMarkers' && Array.isArray(data.markers)) {
        mapApi.setMarkers(data.markers);
      }
    }

    window.addEventListener('message', onHostMessage);
    document.addEventListener('message', onHostMessage);

    function showLeaflet(note) {
      if (ready) return;
      ready = true;
      const map = L.map('map', { zoomControl: false }).setView([lat, lng], 15);
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      let focusMarker = null;
      let userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'me-icon',
          html: meHtml(),
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        }),
        zIndexOffset: 1000,
        interactive: false
      }).addTo(map);

      const spotLayer = L.layerGroup().addTo(map);

      function renderSpots(list) {
        spotLayer.clearLayers();
        (list || []).forEach(function(m) {
          const s = spotStyle(m);
          const size = Math.max(20, s.radius * 2);
          const icon = L.divIcon({
            className: 'spot-icon',
            html: spotHtml(m),
            iconSize: [size, size + 16],
            iconAnchor: [size / 2, size / 2]
          });
          L.marker([m.lat, m.lng], { icon: icon }).addTo(spotLayer).bindPopup(s.title);
        });
      }
      renderSpots(markers);

      map.on('dragstart', emitInteract);
      map.on('zoomstart', function() { if (!programmatic) emitInteract(); });
      map.on('contextmenu', function(e) {
        emitLongPress(e.latlng.lat, e.latlng.lng);
      });
      bindDomLongPress(function(clientX, clientY) {
        const p = map.mouseEventToLatLng({ clientX: clientX, clientY: clientY });
        return p ? { lat: p.lat, lng: p.lng } : null;
      });

      mapApi = {
        setUserLocation: function(plat, plng, center) {
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
          userMarker.setLatLng([plat, plng]);
          if (center) {
            withProgrammatic(function() { map.panTo([plat, plng], { animate: true }); });
          }
        },
        setCenter: function(plat, plng) {
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
          withProgrammatic(function() { map.setView([plat, plng], map.getZoom(), { animate: true }); });
        },
        setFocus: function(plat, plng) {
          if (focusMarker) {
            map.removeLayer(focusMarker);
            focusMarker = null;
          }
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
          focusMarker = L.marker([plat, plng]).addTo(map).bindPopup('조사 위치');
        },
        setMarkers: function(list) {
          markers = list || [];
          renderSpots(markers);
        }
      };

      if (note) {
        const el = document.getElementById('fallback');
        el.style.display = 'block';
        el.textContent = note;
      }
      setTimeout(function() { map.invalidateSize(); emitReady(); }, 100);
    }

    function addKakaoSpot(map, m, bucket) {
      const s = spotStyle(m);
      const size = Math.max(20, s.radius * 2);
      const wrap = document.createElement('div');
      wrap.innerHTML = spotHtml(m);
      const el = wrap.firstChild;
      el.style.marginLeft = (-size / 2) + 'px';
      el.style.marginTop = (-size / 2) + 'px';
      el.addEventListener('click', function() {
        const iw = new kakao.maps.InfoWindow({ content: '<div style="padding:6px 8px;font:12px sans-serif;">' + escapeHtml(s.title) + '</div>' });
        iw.open(map, new kakao.maps.LatLng(m.lat, m.lng));
        setTimeout(function() { iw.close(); }, 2800);
      });
      const overlay = new kakao.maps.CustomOverlay({
        map: map,
        position: new kakao.maps.LatLng(m.lat, m.lng),
        content: el,
        xAnchor: 0,
        yAnchor: 0,
        zIndex: 3
      });
      bucket.push(overlay);
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
          const zoomControl = new kakao.maps.ZoomControl();
          map.addControl(zoomControl, kakao.maps.ControlPosition.TOPRIGHT);

          let focusMarker = null;
          let spotOverlays = [];
          const meEl = document.createElement('div');
          meEl.innerHTML = meHtml();
          meEl.style.marginLeft = '-11px';
          meEl.style.marginTop = '-11px';
          const userOverlay = new kakao.maps.CustomOverlay({
            map: map,
            position: center,
            content: meEl,
            xAnchor: 0,
            yAnchor: 0,
            zIndex: 10
          });

          function renderSpots(list) {
            spotOverlays.forEach(function(o) { o.setMap(null); });
            spotOverlays = [];
            (list || []).forEach(function(m) { addKakaoSpot(map, m, spotOverlays); });
          }
          renderSpots(markers);

          kakao.maps.event.addListener(map, 'dragstart', emitInteract);
          kakao.maps.event.addListener(map, 'zoom_start', function() {
            if (!programmatic) emitInteract();
          });
          kakao.maps.event.addListener(map, 'rightclick', function(mouseEvent) {
            const ll = mouseEvent.latLng;
            emitLongPress(ll.getLat(), ll.getLng());
          });
          bindDomLongPress(function(clientX, clientY) {
            const projection = map.getProjection();
            if (!projection) return null;
            const rect = document.getElementById('map').getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const coords = map.getProjection().coordsFromContainerPoint
              ? map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x, y))
              : null;
            if (coords) return { lat: coords.getLat(), lng: coords.getLng() };
            return { lat: map.getCenter().getLat(), lng: map.getCenter().getLng() };
          });

          mapApi = {
            setUserLocation: function(plat, plng, centerMap) {
              if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
              const ll = new kakao.maps.LatLng(plat, plng);
              userOverlay.setPosition(ll);
              if (centerMap) {
                withProgrammatic(function() { map.panTo(ll); });
              }
            },
            setCenter: function(plat, plng) {
              if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
              withProgrammatic(function() {
                map.setCenter(new kakao.maps.LatLng(plat, plng));
              });
            },
            setFocus: function(plat, plng) {
              if (focusMarker) {
                focusMarker.setMap(null);
                focusMarker = null;
              }
              if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
              focusMarker = new kakao.maps.Marker({
                map: map,
                position: new kakao.maps.LatLng(plat, plng),
                title: '조사 위치'
              });
            },
            setMarkers: function(list) {
              markers = list || [];
              renderSpots(markers);
            }
          };

          emitReady();
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
