import React, { createElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { API_BASE_URL } from '../services/api';
import type { HeatPoint, MapPriceMode, MarkerPoint } from '../utils/mapMarkers';

export type { HeatPoint, MapPriceMode, MarkerPoint };

interface KakaoMapViewProps {
  lat: number;
  lng: number;
  jsKey: string | null;
  markers?: MarkerPoint[];
  /** Soft heat blobs for 평단가 mode. */
  heatPoints?: HeatPoint[];
  /** Controls embed legend + whether heat or spots are primary. */
  mapPriceMode?: MapPriceMode;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Max sale markers to send to the embed (default 20). */
  markerLimit?: number;
  /** Live GPS position for the blue "my location" marker. */
  userLat?: number | null;
  userLng?: number | null;
  /** Degrees from north for nav-style arrow; null shows a plain blue dot. */
  userHeading?: number | null;
  /** When true, pan map to user location as it updates. */
  followUser?: boolean;
  /** Investigated point marker; null clears it. */
  focusLat?: number | null;
  focusLng?: number | null;
  /** Search radius in meters; null/undefined hides the circle. */
  radiusMeters?: number | null;
  /** Circle center (investigate pin or my location). */
  radiusCenterLat?: number | null;
  radiusCenterLng?: number | null;
  onLongPressLocation?: (lat: number, lng: number) => void;
  /** Fired when the user pans/zooms the map. */
  onUserInteract?: () => void;
}

type MapCmd =
  | {
      type: 'appnavi:map-cmd';
      cmd: 'setUserLocation';
      lat: number;
      lng: number;
      center: boolean;
      heading?: number | null;
    }
  | { type: 'appnavi:map-cmd'; cmd: 'setCenter'; lat: number; lng: number }
  | { type: 'appnavi:map-cmd'; cmd: 'setFocus'; lat: number | null; lng: number | null }
  | { type: 'appnavi:map-cmd'; cmd: 'setMarkers'; markers: MarkerPoint[] }
  | { type: 'appnavi:map-cmd'; cmd: 'setHeatLayer'; points: HeatPoint[] }
  | { type: 'appnavi:map-cmd'; cmd: 'setMapLegend'; mode: MapPriceMode }
  | {
      type: 'appnavi:map-cmd';
      cmd: 'setRadiusCircle';
      radiusM: number | null;
      lat?: number | null;
      lng?: number | null;
    };

function serializeMarkers(list: MarkerPoint[], limit: number) {
  return list.slice(0, limit).map((m) => ({
    lat: m.lat,
    lng: m.lng,
    title: m.title ?? '',
    radius: m.radius,
    fillColor: m.fillColor,
    strokeColor: m.strokeColor,
    priceLabel: m.priceLabel ?? '',
    changeLabel: m.changeLabel ?? '',
    changeTone: m.changeTone ?? 'flat',
  }));
}

/**
 * Web map: load embed page from API server (proper origin for Kakao),
 * with OSM Leaflet fallback baked into that page.
 */
export function KakaoMapView({
  lat,
  lng,
  markers = [],
  heatPoints = [],
  mapPriceMode = 'sale',
  height = 320,
  style,
  markerLimit = 20,
  userLat = null,
  userLng = null,
  userHeading = null,
  followUser = false,
  focusLat = null,
  focusLng = null,
  radiusMeters = null,
  radiusCenterLat = null,
  radiusCenterLng = null,
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

  const propsRef = useRef({
    userLat,
    userLng,
    userHeading,
    focusLat,
    focusLng,
    markers,
    heatPoints,
    mapPriceMode,
    markerLimit,
    radiusMeters,
    radiusCenterLat,
    radiusCenterLng,
  });
  propsRef.current = {
    userLat,
    userLng,
    userHeading,
    focusLat,
    focusLng,
    markers,
    heatPoints,
    mapPriceMode,
    markerLimit,
    radiusMeters,
    radiusCenterLat,
    radiusCenterLng,
  };

  // Stable initial URL — live updates go through postMessage.
  const initial = useRef({ lat, lng, markers, markerLimit });
  const src = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(initial.current.lat),
      lng: String(initial.current.lng),
    });
    if (initial.current.markers.length > 0) {
      params.set(
        'markers',
        JSON.stringify(serializeMarkers(initial.current.markers, initial.current.markerLimit)),
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
        heading: p.userHeading ?? null,
      });
    }
    if (p.focusLat != null && p.focusLng != null) {
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: p.focusLat, lng: p.focusLng });
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setCenter', lat: p.focusLat, lng: p.focusLng });
    }
    postCmd({ type: 'appnavi:map-cmd', cmd: 'setMapLegend', mode: p.mapPriceMode });
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setMarkers',
      markers: p.mapPriceMode === 'sale' ? serializeMarkers(p.markers, p.markerLimit) : [],
    });
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setHeatLayer',
      points: p.mapPriceMode === 'pyeong' ? p.heatPoints.slice(0, 80) : [],
    });
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setRadiusCircle',
      radiusM:
        p.radiusMeters != null && Number.isFinite(p.radiusMeters) && p.radiusMeters > 0
          ? p.radiusMeters
          : null,
      lat: p.radiusCenterLat,
      lng: p.radiusCenterLng,
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (event: MessageEvent) => {
      // Ignore messages from other iframes when remounting maps.
      if (iframeRef.current && event.source && event.source !== iframeRef.current.contentWindow) {
        return;
      }
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
      heading: userHeading ?? null,
    });
  }, [userLat, userLng, userHeading, followUser]);

  useEffect(() => {
    if (focusLat != null && focusLng != null && Number.isFinite(focusLat) && Number.isFinite(focusLng)) {
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: focusLat, lng: focusLng });
      postCmd({ type: 'appnavi:map-cmd', cmd: 'setCenter', lat: focusLat, lng: focusLng });
      return;
    }
    postCmd({ type: 'appnavi:map-cmd', cmd: 'setFocus', lat: null, lng: null });
  }, [focusLat, focusLng]);

  useEffect(() => {
    postCmd({ type: 'appnavi:map-cmd', cmd: 'setMapLegend', mode: mapPriceMode });
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setMarkers',
      markers: mapPriceMode === 'sale' ? serializeMarkers(markers, markerLimit) : [],
    });
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setHeatLayer',
      points: mapPriceMode === 'pyeong' ? heatPoints.slice(0, 80) : [],
    });
  }, [markers, heatPoints, mapPriceMode, markerLimit]);

  useEffect(() => {
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setRadiusCircle',
      radiusM:
        radiusMeters != null && Number.isFinite(radiusMeters) && radiusMeters > 0
          ? radiusMeters
          : null,
      lat: radiusCenterLat,
      lng: radiusCenterLng,
    });
  }, [radiusMeters, radiusCenterLat, radiusCenterLng]);

  return (
    <View style={[styles.wrap, height != null ? { height } : null, style]}>
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
