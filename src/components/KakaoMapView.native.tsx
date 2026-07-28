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
  followUser?: boolean;
  focusLat?: number | null;
  focusLng?: number | null;
  onLongPressLocation?: (lat: number, lng: number) => void;
  onUserInteract?: () => void;
}

type MapCmd =
  | { type: 'appnavi:map-cmd'; cmd: 'setUserLocation'; lat: number; lng: number; center: boolean }
  | { type: 'appnavi:map-cmd'; cmd: 'setCenter'; lat: number; lng: number }
  | { type: 'appnavi:map-cmd'; cmd: 'setFocus'; lat: number | null; lng: number | null }
  | { type: 'appnavi:map-cmd'; cmd: 'setMarkers'; markers: MarkerPoint[] };

/** iOS / Android: WebView loads server map-embed (Kakao + OSM fallback). */
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
  const webRef = useRef<WebView>(null);
  const mapReadyRef = useRef(false);
  const longPressRef = useRef(onLongPressLocation);
  const interactRef = useRef(onUserInteract);
  longPressRef.current = onLongPressLocation;
  interactRef.current = onUserInteract;

  const followRef = useRef(followUser);
  followRef.current = followUser;

  const propsRef = useRef({ userLat, userLng, focusLat, focusLng, markers });
  propsRef.current = { userLat, userLng, focusLat, focusLng, markers };

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
