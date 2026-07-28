import type { Request, Response } from 'express';

interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
  priceLabel?: string;
  changeLabel?: string;
  changeTone?: 'up' | 'down' | 'flat';
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
      padding: 2px 6px;
      border-radius: 8px;
      background: rgba(255,255,255,.96);
      box-shadow: 0 1px 3px rgba(0,0,0,.18);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      max-width: 92px;
      white-space: nowrap;
    }
    .spot-price {
      color: #1a2332;
      font: 700 10px/1.15 sans-serif;
    }
    .spot-change {
      font: 700 9px/1.1 sans-serif;
    }
    .spot-change.up { color: #c0392b; }
    .spot-change.down { color: #1f6f4a; }
    .spot-change.flat { color: #5c6670; }
    .heat-label {
      padding: 2px 7px;
      border-radius: 8px;
      background: rgba(255,255,255,.96);
      color: #1a2332;
      font: 700 10px/1.2 sans-serif;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
      pointer-events: none;
    }
    .me-wrap {
      width: 28px;
      height: 28px;
      position: relative;
      transition: transform 0.2s linear;
      will-change: transform;
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
      left: 8px; top: 8px;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #2563eb;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.35);
    }
    .me-arrow {
      position: absolute;
      left: 5px; top: 3px;
      width: 0; height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-bottom: 20px solid #2563eb;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.35));
      display: none;
    }
    .me-arrow::after {
      content: '';
      position: absolute;
      left: -5px; top: 5px;
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 11px solid #fff;
    }
    .me-wrap.has-heading .me-dot { display: none; }
    .me-wrap.has-heading .me-arrow { display: block; }
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
    <div id="legendTitle" style="font-weight:700;margin-bottom:2px">시세 · 거래량</div>
    <div id="legendBody">
      <div class="row"><span class="dot" style="background:rgba(220,38,38,.55)"></span>Top10 고가</div>
      <div class="row"><span class="dot" style="background:rgba(234,88,12,.55)"></span>Top10 중위</div>
      <div class="row"><span class="dot" style="background:rgba(234,179,8,.55)"></span>Top10 저가·그 외</div>
      <div style="margin-top:4px;color:#5c6670">원 크기 = 거래량</div>
    </div>
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
      return '<div class="me-wrap"><div class="me-pulse"></div><div class="me-dot"></div><div class="me-arrow"></div></div>';
    }

    function applyHeading(el, heading) {
      if (!el) return;
      if (heading == null || !Number.isFinite(heading) || heading < 0) {
        el.classList.remove('has-heading');
        el.style.transform = '';
        return;
      }
      el.classList.add('has-heading');
      el.style.transform = 'rotate(' + heading + 'deg)';
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

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
      const tone = m.changeTone === 'up' || m.changeTone === 'down' ? m.changeTone : 'flat';
      return {
        radius: Number(m.radius) > 0 ? Number(m.radius) : 10,
        fillColor: m.fillColor || 'rgba(234,88,12,0.55)',
        strokeColor: m.strokeColor || 'rgba(194,65,12,0.9)',
        title: m.title || '',
        priceLabel: m.priceLabel || '',
        changeLabel: m.changeLabel || '',
        changeTone: tone
      };
    }

    function spotHtml(m) {
      const s = spotStyle(m);
      const size = Math.max(20, s.radius * 2);
      const price = escapeHtml(s.priceLabel);
      const change = escapeHtml(s.changeLabel);
      let label = '';
      if (price || change) {
        label = '<div class="spot-label">'
          + (price ? '<span class="spot-price">' + price + '</span>' : '')
          + (change ? '<span class="spot-change ' + s.changeTone + '">' + change + '</span>' : '')
          + '</div>';
      }
      return '<div class="spot-wrap">'
        + '<div class="spot" style="width:' + size + 'px;height:' + size + 'px;'
        + 'background:' + s.fillColor + ';border-color:' + s.strokeColor + '"></div>'
        + label
        + '</div>';
    }

    function applyMapLegend(mode) {
      const title = document.getElementById('legendTitle');
      const body = document.getElementById('legendBody');
      if (!title || !body) return;
      if (mode === 'pyeong') {
        title.textContent = '평당 매매가';
        body.innerHTML = ''
          + '<div style="height:8px;border-radius:999px;margin-top:4px;'
          + 'background:linear-gradient(90deg,#14b8a6,#eab308,#ea580c,#dc2626)"></div>'
          + '<div style="display:flex;justify-content:space-between;margin-top:3px;color:#5c6670">'
          + '<span>낮음</span><span>높음</span></div>';
      } else {
        title.textContent = '시세 · 거래량';
        body.innerHTML = ''
          + '<div class="row"><span class="dot" style="background:rgba(220,38,38,.55)"></span>Top10 고가</div>'
          + '<div class="row"><span class="dot" style="background:rgba(234,88,12,.55)"></span>Top10 중위</div>'
          + '<div class="row"><span class="dot" style="background:rgba(234,179,8,.55)"></span>Top10 저가·그 외</div>'
          + '<div style="margin-top:4px;color:#5c6670">원 크기 = 거래량</div>';
      }
    }

    function onHostMessage(event) {
      const data = event && event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'appnavi:map-cmd' || !mapApi) return;
      const cmd = data.cmd;
      if (cmd === 'setUserLocation') {
        const heading = data.heading == null ? null : Number(data.heading);
        mapApi.setUserLocation(
          Number(data.lat),
          Number(data.lng),
          !!data.center,
          heading != null && Number.isFinite(heading) ? heading : null
        );
      } else if (cmd === 'setCenter') {
        mapApi.setCenter(Number(data.lat), Number(data.lng));
      } else if (cmd === 'setFocus') {
        mapApi.setFocus(
          data.lat == null ? null : Number(data.lat),
          data.lng == null ? null : Number(data.lng)
        );
      } else if (cmd === 'setMarkers' && Array.isArray(data.markers)) {
        mapApi.setMarkers(data.markers);
      } else if (cmd === 'setHeatLayer') {
        mapApi.setHeatLayer(Array.isArray(data.points) ? data.points : []);
      } else if (cmd === 'setMapLegend') {
        applyMapLegend(data.mode === 'pyeong' ? 'pyeong' : 'sale');
      } else if (cmd === 'setRadiusCircle') {
        const meters = data.radiusM == null ? null : Number(data.radiusM);
        const clat = data.lat == null ? null : Number(data.lat);
        const clng = data.lng == null ? null : Number(data.lng);
        mapApi.setRadiusCircle(
          meters != null && Number.isFinite(meters) && meters > 0 ? meters : null,
          clat != null && Number.isFinite(clat) ? clat : null,
          clng != null && Number.isFinite(clng) ? clng : null
        );
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
      let radiusCircle = null;
      let radiusMeters = null;
      let radiusCenter = { lat: lat, lng: lng };
      let userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'me-icon',
          html: meHtml(),
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        }),
        zIndexOffset: 1000,
        interactive: false
      }).addTo(map);
      let animFrame = null;
      let animFrom = { lat: lat, lng: lng };
      let animTo = { lat: lat, lng: lng };

      function meEl() {
        const root = userMarker.getElement();
        return root ? root.querySelector('.me-wrap') : null;
      }

      function syncRadiusCircle(plat, plng) {
        if (radiusMeters == null || !Number.isFinite(plat) || !Number.isFinite(plng)) {
          if (radiusCircle) {
            map.removeLayer(radiusCircle);
            radiusCircle = null;
          }
          return;
        }
        radiusCenter = { lat: plat, lng: plng };
        if (!radiusCircle) {
          radiusCircle = L.circle([plat, plng], {
            radius: radiusMeters,
            color: 'rgba(34, 160, 80, 0.38)',
            weight: 4,
            fillColor: 'rgba(34, 160, 80, 0.04)',
            fillOpacity: 0.04,
            interactive: false
          }).addTo(map);
        } else {
          radiusCircle.setLatLng([plat, plng]);
          radiusCircle.setRadius(radiusMeters);
          radiusCircle.setStyle({
            color: 'rgba(34, 160, 80, 0.38)',
            weight: 4,
            fillColor: 'rgba(34, 160, 80, 0.04)',
            fillOpacity: 0.04
          });
        }
      }

      function animateUserTo(plat, plng, centerMap, heading) {
        if (animFrame) cancelAnimationFrame(animFrame);
        const cur = userMarker.getLatLng();
        animFrom = { lat: cur.lat, lng: cur.lng };
        animTo = { lat: plat, lng: plng };
        const start = performance.now();
        const dur = 280;
        applyHeading(meEl(), heading);
        function step(now) {
          const t = Math.min(1, (now - start) / dur);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const nextLat = lerp(animFrom.lat, animTo.lat, ease);
          const nextLng = lerp(animFrom.lng, animTo.lng, ease);
          userMarker.setLatLng([nextLat, nextLng]);
          if (centerMap) {
            withProgrammatic(function() {
              map.panTo([nextLat, nextLng], { animate: false });
            });
          }
          if (t < 1) animFrame = requestAnimationFrame(step);
          else animFrame = null;
        }
        animFrame = requestAnimationFrame(step);
      }

      const heatLayer = L.layerGroup().addTo(map);
      const spotLayer = L.layerGroup().addTo(map);

      function renderHeat(list) {
        heatLayer.clearLayers();
        (list || []).forEach(function(h) {
          if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) return;
          const intensity = Number(h.intensity);
          const t = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5;
          const radius = Number(h.radiusM) > 0 ? Number(h.radiusM) : 400;
          const color = h.fillColor || '#ea580c';
          L.circle([h.lat, h.lng], {
            radius: radius,
            color: color,
            weight: 0,
            fillColor: color,
            // Lower transparency (higher opacity) so heat beats base map contrast.
            fillOpacity: 0.42 + t * 0.28,
            interactive: false
          }).addTo(heatLayer);
          const label = escapeHtml(h.priceLabel || '');
          if (label) {
            const icon = L.divIcon({
              className: 'spot-icon',
              html: '<div class="heat-label">' + label + '</div>',
              iconSize: [88, 20],
              iconAnchor: [44, 10]
            });
            L.marker([h.lat, h.lng], { icon: icon, interactive: false, keyboard: false })
              .addTo(heatLayer);
          }
        });
      }

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
        setUserLocation: function(plat, plng, center, heading) {
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
          animateUserTo(plat, plng, !!center, heading);
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
        },
        setHeatLayer: function(list) {
          renderHeat(list || []);
        },
        setRadiusCircle: function(meters, plat, plng) {
          radiusMeters = meters;
          if (meters == null) {
            syncRadiusCircle(null, null);
            return;
          }
          const cur = userMarker.getLatLng();
          const useLat = plat != null ? plat : (radiusCenter.lat ?? cur.lat);
          const useLng = plng != null ? plng : (radiusCenter.lng ?? cur.lng);
          syncRadiusCircle(useLat, useLng);
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
          let radiusCircle = null;
          let radiusMeters = null;
          let radiusCenter = { lat: lat, lng: lng };
          let spotOverlays = [];
          let heatCircles = [];
          let heatLabels = [];
          const meHost = document.createElement('div');
          meHost.innerHTML = meHtml();
          const meWrap = meHost.firstChild;
          meHost.style.marginLeft = '-14px';
          meHost.style.marginTop = '-14px';
          const userOverlay = new kakao.maps.CustomOverlay({
            map: map,
            position: center,
            content: meHost,
            xAnchor: 0,
            yAnchor: 0,
            zIndex: 10
          });
          let animFrame = null;
          let animFrom = { lat: lat, lng: lng };
          let animTo = { lat: lat, lng: lng };

          function syncRadiusCircle(plat, plng) {
            if (radiusMeters == null || !Number.isFinite(plat) || !Number.isFinite(plng)) {
              if (radiusCircle) {
                radiusCircle.setMap(null);
                radiusCircle = null;
              }
              return;
            }
            radiusCenter = { lat: plat, lng: plng };
            const ll = new kakao.maps.LatLng(plat, plng);
            if (!radiusCircle) {
              radiusCircle = new kakao.maps.Circle({
                center: ll,
                radius: radiusMeters,
                strokeWeight: 4,
                strokeColor: '#22a050',
                strokeOpacity: 0.38,
                strokeStyle: 'solid',
                fillColor: '#22a050',
                fillOpacity: 0.04
              });
              radiusCircle.setMap(map);
            } else {
              radiusCircle.setPosition(ll);
              radiusCircle.setRadius(radiusMeters);
              radiusCircle.setOptions({
                strokeOpacity: 0.38,
                fillOpacity: 0.04
              });
            }
          }

          function animateUserTo(plat, plng, centerMap, heading) {
            if (animFrame) cancelAnimationFrame(animFrame);
            const cur = userOverlay.getPosition();
            animFrom = { lat: cur.getLat(), lng: cur.getLng() };
            animTo = { lat: plat, lng: plng };
            const start = performance.now();
            const dur = 280;
            applyHeading(meWrap, heading);
            function step(now) {
              const t = Math.min(1, (now - start) / dur);
              const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              const nextLat = lerp(animFrom.lat, animTo.lat, ease);
              const nextLng = lerp(animFrom.lng, animTo.lng, ease);
              const ll = new kakao.maps.LatLng(nextLat, nextLng);
              userOverlay.setPosition(ll);
              if (centerMap) {
                withProgrammatic(function() { map.setCenter(ll); });
              }
              if (t < 1) animFrame = requestAnimationFrame(step);
              else animFrame = null;
            }
            animFrame = requestAnimationFrame(step);
          }

          function renderHeat(list) {
            heatCircles.forEach(function(c) { c.setMap(null); });
            heatLabels.forEach(function(o) { o.setMap(null); });
            heatCircles = [];
            heatLabels = [];
            (list || []).forEach(function(h) {
              if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) return;
              const intensity = Number(h.intensity);
              const t = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5;
              const radius = Number(h.radiusM) > 0 ? Number(h.radiusM) : 400;
              const color = h.fillColor || '#ea580c';
              const center = new kakao.maps.LatLng(h.lat, h.lng);
              const circle = new kakao.maps.Circle({
                center: center,
                radius: radius,
                strokeWeight: 0,
                strokeOpacity: 0,
                fillColor: color,
                // Lower transparency (higher opacity) so heat beats base map contrast.
                fillOpacity: 0.42 + t * 0.28,
                zIndex: 1
              });
              circle.setMap(map);
              heatCircles.push(circle);
              const label = String(h.priceLabel || '');
              if (label) {
                const el = document.createElement('div');
                el.className = 'heat-label';
                el.textContent = label;
                const overlay = new kakao.maps.CustomOverlay({
                  map: map,
                  position: center,
                  content: el,
                  xAnchor: 0.5,
                  yAnchor: 0.5,
                  zIndex: 2
                });
                heatLabels.push(overlay);
              }
            });
          }

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
            setUserLocation: function(plat, plng, centerMap, heading) {
              if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
              animateUserTo(plat, plng, !!centerMap, heading);
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
            },
            setHeatLayer: function(list) {
              renderHeat(list || []);
            },
            setRadiusCircle: function(meters, plat, plng) {
              radiusMeters = meters;
              if (meters == null) {
                syncRadiusCircle(null, null);
                return;
              }
              const cur = userOverlay.getPosition();
              const useLat = plat != null ? plat : (radiusCenter.lat ?? cur.getLat());
              const useLng = plng != null ? plng : (radiusCenter.lng ?? cur.getLng());
              syncRadiusCircle(useLat, useLng);
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
