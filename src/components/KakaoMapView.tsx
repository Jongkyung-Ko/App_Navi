import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
}

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
}

function buildHtml(lat: number, lng: number, jsKey: string | null, markers: MarkerPoint[]): string {
  const markerJson = JSON.stringify(markers);
  const key = jsKey ?? '';

  // When no Kakao JS key, render a lightweight OSM leaflet fallback (still free).
  if (!key) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{margin:0;height:100%;width:100%;} .label{background:#1a2332;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;}</style>
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
      window.recenter = function(lat, lng) {
        map.setCenter(new kakao.maps.LatLng(lat, lng));
      };
    });
  </script>
</body>
</html>`;
}

export function KakaoMapView({ lat, lng, jsKey, markers = [], height = 320 }: KakaoMapViewProps) {
  const html = useMemo(() => buildHtml(lat, lng, jsKey, markers), [lat, lng, jsKey, markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: Platform.OS === 'android' ? 'https://localhost' : undefined }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d5dbe3',
  },
  web: {
    flex: 1,
    backgroundColor: '#e8eef4',
  },
});
