import React, { createElement, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildMapHtml, type MarkerPoint } from './mapHtml';

export type { MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
}

/**
 * Default / web map renderer.
 * Must NOT import react-native-webview (unsupported on web).
 */
export function KakaoMapView({ lat, lng, jsKey, markers = [], height = 320 }: KakaoMapViewProps) {
  const html = useMemo(() => buildMapHtml(lat, lng, jsKey, markers), [lat, lng, jsKey, markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        srcDoc: html,
        title: 'map',
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#e8eef4',
        },
      })}
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
});
