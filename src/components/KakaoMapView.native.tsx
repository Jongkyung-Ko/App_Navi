import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml, type MarkerPoint } from './mapHtml';

export type { MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
}

/** iOS / Android map via react-native-webview */
export function KakaoMapView({ lat, lng, jsKey, markers = [], height = 320 }: KakaoMapViewProps) {
  const html = useMemo(() => buildMapHtml(lat, lng, jsKey, markers), [lat, lng, jsKey, markers]);

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
