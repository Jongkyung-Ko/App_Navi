import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { API_BASE_URL } from '../services/api';
import type { MarkerPoint } from '../utils/mapMarkers';

export type { MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
  onLongPressLocation?: (lat: number, lng: number) => void;
}

/** iOS / Android: WebView loads server map-embed (Kakao + OSM fallback). */
export function KakaoMapView({
  lat,
  lng,
  markers = [],
  height = 320,
  onLongPressLocation,
}: KakaoMapViewProps) {
  const handlerRef = useRef(onLongPressLocation);
  handlerRef.current = onLongPressLocation;

  const uri = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (markers.length > 0) {
      params.set(
        'markers',
        JSON.stringify(
          markers.slice(0, 20).map((m) => ({
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

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        lat?: number;
        lng?: number;
      };
      if (data.type !== 'appnavi:map-longpress') return;
      const plat = Number(data.lat);
      const plng = Number(data.lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      handlerRef.current?.(plat, plng);
    } catch {
      // ignore
    }
  };

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
        onMessage={onMessage}
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
