import React, { useEffect, useMemo, useRef } from 'react';
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
  userLat?: number | null;
  userLng?: number | null;
  userHeading?: number | null;
  followUser?: boolean;
  focusLat?: number | null;
  focusLng?: number | null;
  radiusMeters?: number | null;
  radiusCenterLat?: number | null;
  radiusCenterLng?: number | null;
  onLongPressLocation?: (lat: number, lng: number) => void;
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
  | {
      type: 'appnavi:map-cmd';
      cmd: 'setRadiusCircle';
      radiusM: number | null;
      lat?: number | null;
      lng?: number | null;
    };

/** iOS / Android: WebView loads server map-embed (Kakao + OSM fallback). */
export function KakaoMapView({
  lat,
  lng,
  markers = [],
  height = 320,
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
  const webRef = useRef<WebView>(null);
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
    radiusMeters,
    radiusCenterLat,
    radiusCenterLng,
  };

  const initial = useRef({ lat, lng, markers });
  const uri = useMemo(() => {
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
    if (!mapReadyRef.current || !webRef.current) return;
    const js = `window.postMessage(${JSON.stringify(cmd)}, '*'); true;`;
    webRef.current.injectJavaScript(js);
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
    if (p.markers.length > 0) {
      postCmd({
        type: 'appnavi:map-cmd',
        cmd: 'setMarkers',
        markers: p.markers.slice(0, 20),
      });
    }
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

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        lat?: number;
        lng?: number;
      };
      if (data.type === 'appnavi:map-ready') {
        mapReadyRef.current = true;
        syncAfterReady();
        return;
      }
      if (data.type === 'appnavi:map-longpress') {
        const plat = Number(data.lat);
        const plng = Number(data.lng);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
        longPressRef.current?.(plat, plng);
        return;
      }
      if (data.type === 'appnavi:map-interact') {
        interactRef.current?.();
      }
    } catch {
      // ignore
    }
  };

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
    postCmd({
      type: 'appnavi:map-cmd',
      cmd: 'setMarkers',
      markers: markers.slice(0, 20),
    });
  }, [markers]);

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
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
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
