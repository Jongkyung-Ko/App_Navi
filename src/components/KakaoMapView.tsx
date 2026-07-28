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
  /** Live GPS position for the blue "my location" marker. */
  userLat?: number | null;
  userLng?: number | null;
  /** When true, pan map to user location as it updates. */
  followUser?: boolean;
  /** Investigated point marker; null clears it. */
  focusLat?: number | null;
  focusLng?: number | null;
  onLongPressLocation?: (lat: number, lng: number) => void;
  /** Fired when the user pans/zooms the map. */
  onUserInteract?: () => void;
}

type MapCmd =
  | { type: 'appnavi:map-cmd'; cmd: 'setUserLocation'; lat: number; lng: number; center: boolean }
  | { type: 'appnavi:map-cmd'; cmd: 'setCenter'; lat: number; lng: number }
  | { type: 'appnavi:map-cmd'; cmd: 'setFocus'; lat: number | null; lng: number | null }
  | { type: 'appnavi:map-cmd'; cmd: 'setMarkers'; markers: MarkerPoint[] };

/**
 * Web map: load embed page from API server (proper origin for Kakao),
 * with OSM Leaflet fallback baked into that page.
 */
export function KakaoMapView({
  lat,
  lng,
  markers = [],
  height = 320,
  userLat = null,
  userLng = null,
  followUser = false,
  focusLat = null,
  focusLng = null,
  onLongPressLocation,
  onUserInteract,
}: KakaoMapViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mapReadyRef = useRef(false);
  const longPressRef = useRef(onLongPressLocation);
  const interactRef = useRef(onUserInteract);
  longPressRef.current = onLongPressLocation;
  interactRef.current = onUserInteract;

  const followRef = useRef(followUser);
  followRef.current = followUser;

  const propsRef = useRef({ userLat, userLng, focusLat, focusLng, markers });
  propsRef.current = { userLat, userLng, focusLat, focusLng, markers };

  // Stable initial URL — live updates go through postMessage.
  const initial = useRef({ lat, lng, markers });
  const src = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(initial.current.lat),
      lng: String(initial.current.lng),
    });
    if (initial.current.markers.length > 0) {
      params.set(
        'markers',
        JSON.stringify(
          initial.current.markers.slice(0, 20).map((m) => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postCmd = (cmd: MapCmd) => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !mapReadyRef.current) return;
    try {
      win.postMessage(cmd, '*');
    } catch {
      // ignore
    }
  };

  const syncAfterReady = () => {
    const p = propsRef.current;
    if (p.userLat != null && p.userLng != null && Number.isFinite(p.userLat) && Number.isFinite(p.userLng)) {
      postCmd({
        type: 'appnavi:map-cmd',
        cmd: 'setUserLocation',
        lat: p.userLat,
        lng: p.userLng,
        center: followRef.current,
      });
    }
    if (p.focusLat != null && p.focusLng != null) {
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: p.focusLat, lng: p.focusLng });
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setCenter', lat: p.focusLat, lng: p.focusLng });
    }
    if (p.markers.length > 0) {
      postCmd({
        type: 'appnavi:map-cmd',
        cmd: 'setMarkers',
        markers: p.markers.slice(0, 20),
      });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const type = (data as { type?: string }).type;
      if (type === 'appnavi:map-ready') {
        mapReadyRef.current = true;
        syncAfterReady();
        return;
      }
      if (type === 'appnavi:map-longpress') {
        const plat = Number((data as { lat?: number }).lat);
        const plng = Number((data as { lng?: number }).lng);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
        longPressRef.current?.(plat, plng);
        return;
      }
      if (type === 'appnavi:map-interact') {
        interactRef.current?.();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // Intentionally only bind once; handlers use refs / postCmd.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userLat == null || userLng == null) return;
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setUserLocation',
      lat: userLat,
      lng: userLng,
      center: followUser,
    });
  }, [userLat, userLng, followUser]);

  useEffect(() => {
    if (focusLat != null && focusLng != null && Number.isFinite(focusLat) && Number.isFinite(focusLng)) {
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: focusLat, lng: focusLng });
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setCenter', lat: focusLat, lng: focusLng });
      return;
    }
    postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: null, lng: null });
  }, [focusLat, focusLng]);

  // Force-center when parent lat/lng jumps (e.g. "내 위치로") while following.
  useEffect(() => {
    if (!followUser) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    postCmd({ type: 'appnavi:map-cmd', cmd: 'setCenter', lat, lng });
  }, [lat, lng, followUser]);

  useEffect(() => {
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setMarkers',
      markers: markers.slice(0, 20),
    });
  }, [markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        ref: (el: HTMLIFrameElement | null) => {
          iframeRef.current = el;
        },
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
