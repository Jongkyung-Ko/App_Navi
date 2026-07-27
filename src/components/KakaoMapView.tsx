import React, { createElement, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { API_BASE_URL } from '../services/api';
import type { MarkerPoint } from './mapHtml';

export type { MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  height?: number;
}

/**
 * Web map: load embed page from API server (proper origin for Kakao),
 * with OSM Leaflet fallback baked into that page.
 */
export function KakaoMapView({ lat, lng, markers = [], height = 320 }: KakaoMapViewProps) {
  const src = useMemo(() => {
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
          })),
        ),
      );
    }
    return `${API_BASE_URL}/map-embed?${params.toString()}`;
  }, [lat, lng, markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        src,
        title: 'map',
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#e8eef4',
        },
        allow: 'geolocation',
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
