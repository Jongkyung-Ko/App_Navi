import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_BASE_URL } from '../services/api';
import type { MarkerPoint } from '../utils/mapMarkers';

export type { MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
}

/** iOS / Android: WebView loads server map-embed (Kakao + OSM fallback). */
export function KakaoMapView({ lat, lng, markers = [], height = 320 }: KakaoMapViewProps) {
  const uri = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (markers.length > 0) {
      params.set(
        'markers',
        JSON.stringify(
          markers.slice(0, 12).map((m) => ({
            lat: m.lat,
            lng: m.lng,
            title: m.title ?? '',
            radius: m.radius,
            fillColor: m.fillColor,
            strokeColor: m.strokeColor,
          })),
        ),
      );
    }
    return `${API_BASE_URL}/map-embed?${params.toString()}`;
  }, [lat, lng, markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ uri }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
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
