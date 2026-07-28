import React, { createElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
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

/**
 * Web map: load embed page from API server (proper origin for Kakao),
 * with OSM Leaflet fallback baked into that page.
 */
export function KakaoMapView({
  lat,
  lng,
  markers = [],
  height = 320,
  onLongPressLocation,
}: KakaoMapViewProps) {
  const handlerRef = useRef(onLongPressLocation);
  handlerRef.current = onLongPressLocation;

  const src = useMemo(() => {
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
            priceLabel: m.priceLabel ?? '',
          })),
        ),
      );
    }
    return `${API_BASE_URL}/map-embed?${params.toString()}`;
  }, [lat, lng, markers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if ((data as { type?: string }).type !== 'appnavi:map-longpress') return;
      const plat = Number((data as { lat?: number }).lat);
      const plng = Number((data as { lng?: number }).lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      handlerRef.current?.(plat, plng);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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
