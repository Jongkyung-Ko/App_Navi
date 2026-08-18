import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressCard } from '../src/components/AddressCard';
import { AreaBandChips } from '../src/components/AreaBandChips';
import { ComplexList } from '../src/components/ComplexList';
import { ErrorBanner } from '../src/components/ErrorBanner';
import { FeatureToggle } from '../src/components/FeatureToggle';
import { FullscreenTextCardOverlay, FullscreenTextCardToggle } from '../src/components/FullscreenTextCardOverlay';
import { KakaoMapView } from '../src/components/KakaoMapView';
import { LoadingBlock } from '../src/components/LoadingBlock';
import { NarrationToggle } from '../src/components/NarrationToggle';
import { GapGapGapLinkButton } from '../src/components/GapGapGapLink';
import { PwaInstallButton, PwaInstallPrompt } from '../src/components/PwaInstall';
import { SearchScopeChips } from '../src/components/SearchScopeChips';
import { useCurrentLocation } from '../src/hooks/useCurrentLocation';
import { useNearbySettings } from '../src/hooks/useNearbySettings';
import { useNarrationSettings } from '../src/hooks/useNarrationSettings';
import { usePwaInstall } from '../src/hooks/usePwaInstall';
import { narrationSettingsHint } from '../src/services/narrationSettings';
import { fetchKakaoJsKey, fetchNearbyComplexes, reverseGeocode } from '../src/services/api';
import { getNearbyCache, setNearbyCache } from '../src/services/nearbyCache';
import { formatRadiusLabel, scopeLabel } from '../src/services/nearbySettings';
import {
  getCurrentLocation,
  LocationError,
  watchLiveLocation,
  watchLocationChanges,
} from '../src/services/location';
import { speakNarration, stopNarration } from '../src/services/speech';
import type {
  ComplexSummary,
  NearbySearchScope,
  ReverseGeocodeResult,
  UserLocation,
} from '../src/types';
import { formatAreaBandLabel } from '../src/utils/areaBands';
import { confirmMapInvestigate } from '../src/utils/confirm';
import { distanceMeters } from '../src/utils/geo';
import {
  buildPyeongHeatPoints,
  buildStyledMapMarkers,
  sortBySalePriceDesc,
  type MapPriceMode,
} from '../src/utils/mapMarkers';
import {
  buildNearbyNarration,
  buildTop3ChangedScript,
  buildTop3InvestigateScript,
  formatManwonSpoken,
  top3Fingerprint,
} from '../src/utils/narration';

const MOVE_THRESHOLD_M = 100;
const MOVE_POLL_MS = 30_000;
/** After the user pans the map, return to GPS center if idle this long — unless prices were investigated. */
const MAP_IDLE_RETURN_MS = 15_000;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { location, address, loading, error, refresh } = useCurrentLocation();
  const { settings: nearbySettings, ready: nearbySettingsReady, update: updateNearbySettings } =
    useNearbySettings();
  const { settings: narrationSettings, ready: narrationSettingsReady } = useNarrationSettings();
  const pwa = usePwaInstall();
  const [jsKey, setJsKey] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<ComplexSummary[]>([]);
  const [availableAreaTargets, setAvailableAreaTargets] = useState<number[]>([]);
  const [areaTarget, setAreaTarget] = useState<number | undefined>(84);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [narrationOn, setNarrationOn] = useState(false);
  const [moveWatchOn, setMoveWatchOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [moveStatus, setMoveStatus] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<UserLocation | null>(null);
  const [mapAddress, setMapAddress] = useState<ReverseGeocodeResult | null>(null);
  const [mapPriceMode, setMapPriceMode] = useState<MapPriceMode>('sale');
  const [investigating, setInvestigating] = useState(false);
  const [showTop3Card, setShowTop3Card] = useState(false);
  /** Live GPS for the blue map marker (updated more often than address refresh). */
  const [liveLocation, setLiveLocation] = useState<UserLocation | null>(null);
  /** Keep map centered on GPS until the user pans (or investigates prices). */
  const [followUser, setFollowUser] = useState(true);
  /** Expand map to fullscreen while keeping home narration state alive. */
  const [mapFullscreen, setMapFullscreen] = useState(false);
  /** Fullscreen text cards driven by narration settings (independent of speech). */
  const [textCardsOn, setTextCardsOn] = useState(true);

  const narrationFingerprint = useRef<string | null>(null);
  const announcedTop3Key = useRef<string | null>(null);
  const anchorLoc = useRef<UserLocation | null>(null);
  const pendingMoveCheck = useRef(false);
  const moveBusy = useRef(false);
  const pendingSpeakTop3 = useRef(false);
  const skipAutoLoad = useRef(false);
  const locationRef = useRef(location);
  const addressRef = useRef(address);
  const areaTargetRef = useRef(areaTarget);
  const mapFocusRef = useRef(mapFocus);
  const mapAddressRef = useRef(mapAddress);
  const nearbySettingsRef = useRef(nearbySettings);
  const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True after a successful 매매가 investigate — blocks 15s auto-return until locate is pressed. */
  const priceLockRef = useRef(false);

  locationRef.current = location;
  addressRef.current = address;
  areaTargetRef.current = areaTarget;
  mapFocusRef.current = mapFocus;
  mapAddressRef.current = mapAddress;
  nearbySettingsRef.current = nearbySettings;

  const userLoc = liveLocation ?? location;
  /** Stable point for trade lookups — avoid refetching on every live GPS tick. */
  const searchLoc = mapFocus ?? location ?? liveLocation;
  const activeLoc = mapFocus ?? userLoc;
  const activeAddress = mapFocus ? mapAddress : address;

  const clearIdleReturnTimer = useCallback(() => {
    if (idleReturnTimer.current) {
      clearTimeout(idleReturnTimer.current);
      idleReturnTimer.current = null;
    }
  }, []);

  const resumeFollowMyLocation = useCallback(() => {
    clearIdleReturnTimer();
    priceLockRef.current = false;
    setMapFocus(null);
    setMapAddress(null);
    setFollowUser(true);
  }, [clearIdleReturnTimer]);

  useEffect(() => {
    void fetchKakaoJsKey()
      .then(setJsKey)
      .catch(() => setJsKey(null));
  }, []);

  // Seed / sync live GPS from the one-shot location hook.
  useEffect(() => {
    if (location) setLiveLocation(location);
  }, [location]);

  // Nav-style live GPS for the blue marker + follow-centering (~1s / 1m).
  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    void watchLiveLocation((loc) => {
      if (cancelled) return;
      setLiveLocation(loc);
    })
      .then((sub) => {
        if (cancelled) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch(() => {
        // Fall back to one-shot location from useCurrentLocation.
      });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // 15s idle return after pan — skipped once 매매가 was investigated (price lock).
  // Also turn off 이동시 인식: user is browsing the map, not following GPS moves.
  const onMapUserInteract = useCallback(() => {
    setMoveWatchOn(false);
    if (priceLockRef.current || mapFocusRef.current) {
      setFollowUser(false);
      clearIdleReturnTimer();
      return;
    }
    setFollowUser(false);
    clearIdleReturnTimer();
    idleReturnTimer.current = setTimeout(() => {
      idleReturnTimer.current = null;
      if (priceLockRef.current || mapFocusRef.current) return;
      setFollowUser(true);
    }, MAP_IDLE_RETURN_MS);
  }, [clearIdleReturnTimer]);

  useEffect(() => {
    return () => clearIdleReturnTimer();
  }, [clearIdleReturnTimer]);

  const loadComplexes = useCallback(
    async (opts?: {
      lawdCd?: string;
      lat?: number;
      lng?: number;
      quiet?: boolean;
      areaTarget?: number;
    }) => {
      const focus = mapFocusRef.current;
      const focusAddr = mapAddressRef.current;
      const lawdCd =
        opts?.lawdCd ?? (focus ? focusAddr?.lawdCd : undefined) ?? addressRef.current?.lawdCd;
      const lat = opts?.lat ?? focus?.lat ?? locationRef.current?.lat;
      const lng = opts?.lng ?? focus?.lng ?? locationRef.current?.lng;
      const selectedArea =
        opts && 'areaTarget' in opts ? opts.areaTarget : areaTargetRef.current;
      const search = nearbySettingsRef.current;
      if (!lawdCd || lat === undefined || lng === undefined) return;

      if (!opts?.quiet) setListLoading(true);
      setListError(null);
      try {
        const res = await fetchNearbyComplexes({
          lawdCd,
          months: 3,
          enrichCoords: true,
          lat,
          lng,
          areaTarget: selectedArea,
          radiusKm: search.scope === 'radius' ? search.radiusKm : undefined,
        });
        // Keep enough geocoded complexes for 평단가 heat overlay; list still shows top 8.
        const ranked = sortBySalePriceDesc(res.complexes).slice(0, 60);
        setComplexes(ranked);
        const bandTargets = res.areaBands?.map((b) => b.targetM2) ?? [];
        if (bandTargets.length) setAvailableAreaTargets(bandTargets);
        // Cache GPS-based results for "현재 위치" quick restore (server cache still used on fetch).
        if (!mapFocusRef.current) {
          setNearbyCache({
            lawdCd,
            areaTarget: selectedArea,
            scope: search.scope,
            radiusKm: search.scope === 'radius' ? search.radiusKm : undefined,
            complexes: ranked,
            areaBands: bandTargets,
          });
        }
      } catch (err) {
        setListError(err instanceof Error ? err.message : '시세 조회 실패');
      } finally {
        if (!opts?.quiet) setListLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!nearbySettingsReady) return;
    if (!activeAddress?.lawdCd || !searchLoc) return;
    if (skipAutoLoad.current) {
      skipAutoLoad.current = false;
      return;
    }
    void loadComplexes({
      lawdCd: activeAddress.lawdCd,
      lat: searchLoc.lat,
      lng: searchLoc.lng,
    });
  }, [
    loadComplexes,
    nearbySettingsReady,
    nearbySettings.scope,
    nearbySettings.radiusKm,
    activeAddress?.lawdCd,
    searchLoc?.lat,
    searchLoc?.lng,
    areaTarget,
  ]);

  const goToMyLocation = useCallback(async () => {
    setInvestigating(true);
    setListError(null);
    try {
      resumeFollowMyLocation();
      const loc = await getCurrentLocation();
      setLiveLocation(loc);
      const geo = await reverseGeocode(loc.lat, loc.lng);
      const search = nearbySettingsRef.current;
      const cached = getNearbyCache(
        geo.lawdCd,
        areaTargetRef.current,
        search.scope,
        search.scope === 'radius' ? search.radiusKm : undefined,
      );
      skipAutoLoad.current = true;
      await refresh();
      if (cached && cached.complexes.length > 0) {
        setComplexes(cached.complexes);
        if (cached.areaBands.length) setAvailableAreaTargets(cached.areaBands);
        // Background refresh still hits server MOLIT/Kakao memory cache.
        void loadComplexes({
          lawdCd: geo.lawdCd,
          lat: loc.lat,
          lng: loc.lng,
          quiet: true,
        });
      } else {
        skipAutoLoad.current = false;
        await loadComplexes({
          lawdCd: geo.lawdCd,
          lat: loc.lat,
          lng: loc.lng,
        });
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '현재 위치를 불러오지 못했습니다.');
      skipAutoLoad.current = false;
      await refresh();
    } finally {
      setInvestigating(false);
    }
  }, [loadComplexes, refresh, resumeFollowMyLocation]);

  const investigateAt = useCallback(
    async (plat: number, plng: number) => {
      const ok = await confirmMapInvestigate(nearbySettingsRef.current);
      if (!ok) return;
      setInvestigating(true);
      setListError(null);
      try {
        const geo = await reverseGeocode(plat, plng);
        pendingSpeakTop3.current = true;
        setShowTop3Card(true);
        clearIdleReturnTimer();
        priceLockRef.current = true;
        setFollowUser(false);
        setMapFocus({ lat: plat, lng: plng });
        setMapAddress(geo);
      } catch (err) {
        pendingSpeakTop3.current = false;
        setListError(err instanceof Error ? err.message : '위치를 조사하지 못했습니다.');
      } finally {
        setInvestigating(false);
      }
    },
    [clearIdleReturnTimer],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await goToMyLocation();
    setRefreshing(false);
  }, [goToMyLocation]);

  const narration = useMemo(
    () =>
      buildNearbyNarration(
        complexes,
        areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : undefined,
        narrationSettings,
      ),
    [complexes, areaTarget, narrationSettings],
  );

  const speakScript = useCallback((script: string) => {
    setSpeaking(true);
    speakNarration(script, {
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, []);

  const playNarration = useCallback(
    (force = false) => {
      if (complexes.length === 0) return;
      const fingerprint = narration.script;
      if (!force && narrationFingerprint.current === fingerprint) return;
      narrationFingerprint.current = fingerprint;
      announcedTop3Key.current = top3Fingerprint(narration.top3, narration.metrics);
      speakScript(narration.script);
    },
    [complexes.length, narration, speakScript],
  );

  useEffect(() => {
    if (!narrationOn) {
      if (!moveWatchOn) {
        stopNarration();
        setSpeaking(false);
      }
      narrationFingerprint.current = null;
      return;
    }
    if (!narrationSettingsReady) return;
    if (listLoading || complexes.length === 0) return;
    playNarration();
    // Re-speak on toggle / area / settings / first ready data; move-watch handles TopN change announces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    narrationOn,
    listLoading,
    areaTarget,
    complexes.length,
    narrationSettingsReady,
    narrationSettings.metrics,
    narrationSettings.topCount,
  ]);

  // After a move-triggered reload, announce only if Top N changed.
  useEffect(() => {
    if (!pendingMoveCheck.current || !moveWatchOn) return;
    pendingMoveCheck.current = false;

    const key = top3Fingerprint(narration.top3, narration.metrics);
    if (announcedTop3Key.current !== null && key === announcedTop3Key.current) {
      setMoveStatus(`이동 확인 · Top ${narration.topCount} 변동 없음`);
      return;
    }

    announcedTop3Key.current = key;
    narrationFingerprint.current = narration.script;
    setMoveStatus(
      narration.top3.length > 0
        ? `이동 감지 · Top ${narration.topCount} 갱신, 다시 읽어줍니다`
        : '이동 확인 · 주변 매매 단지 없음',
    );
    speakScript(buildTop3ChangedScript(narration));
  }, [complexes, narration, speakScript, moveWatchOn]);

  // Long-press investigate: speak Top N once data is ready.
  useEffect(() => {
    if (!pendingSpeakTop3.current) return;
    if (listLoading || investigating) return;
    pendingSpeakTop3.current = false;
    const stats = buildNearbyNarration(
      complexes,
      areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : undefined,
      narrationSettings,
    );
    narrationFingerprint.current = stats.script;
    announcedTop3Key.current = top3Fingerprint(stats.top3, stats.metrics);
    setShowTop3Card(true);
    if (stats.top3.length === 0) {
      speakScript(stats.script);
      return;
    }
    speakScript(buildTop3InvestigateScript(stats));
  }, [
    complexes,
    listLoading,
    investigating,
    areaTarget,
    speakScript,
    narrationSettings,
  ]);

  const runMoveCheck = useCallback(async (reason: 'distance' | 'interval' | 'watch') => {
    if (moveBusy.current) return;
    moveBusy.current = true;
    try {
      const loc = await getCurrentLocation();
      const prev = anchorLoc.current;
      const movedM = prev ? distanceMeters(prev, loc) : MOVE_THRESHOLD_M;

      // Interval fallback always checks; watch/distance require ≥100m.
      if (reason !== 'interval' && movedM < MOVE_THRESHOLD_M) {
        return;
      }

      if (reason === 'interval' && prev && movedM < MOVE_THRESHOLD_M) {
        // Still re-check Top 3 every 30s even if GPS drift is small (user fallback).
      }

      anchorLoc.current = loc;
      const geo = await reverseGeocode(loc.lat, loc.lng);
      pendingMoveCheck.current = true;
      setMoveStatus(
        movedM >= MOVE_THRESHOLD_M
          ? `약 ${Math.round(movedM)}m 이동 · Top 3 확인 중…`
          : '30초 주기 · Top 3 확인 중…',
      );
      await loadComplexes({
        lawdCd: geo.lawdCd,
        lat: loc.lat,
        lng: loc.lng,
        quiet: true,
      });
      // Also sync main location UI when we moved meaningfully.
      if (movedM >= MOVE_THRESHOLD_M) {
        // Move-watch refresh recenters on GPS; clears investigate lock.
        resumeFollowMyLocation();
        setLiveLocation(loc);
        await refresh();
      }
    } catch (err) {
      const message =
        err instanceof LocationError
          ? err.message
          : err instanceof Error
            ? err.message
            : '이동 인식 실패';
      setMoveStatus(message);
      pendingMoveCheck.current = false;
    } finally {
      moveBusy.current = false;
    }
  }, [loadComplexes, refresh, resumeFollowMyLocation]);

  useEffect(() => {
    if (!moveWatchOn) {
      setMoveStatus(null);
      return;
    }

    anchorLoc.current = locationRef.current;
    announcedTop3Key.current = top3Fingerprint(
      buildNearbyNarration(complexes, undefined, narrationSettings).top3,
      narrationSettings.metrics,
    );
    setMoveStatus('이동 인식 On · 100m 이동 또는 30초마다 확인');

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    const pollId = setInterval(() => {
      void runMoveCheck('interval');
    }, MOVE_POLL_MS);

    void watchLocationChanges((loc) => {
      if (cancelled) return;
      const prev = anchorLoc.current;
      if (prev && distanceMeters(prev, loc) < MOVE_THRESHOLD_M) return;
      void runMoveCheck('watch');
    })
      .then((sub) => {
        if (cancelled) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch((err) => {
        const message =
          err instanceof LocationError
            ? err.message
            : err instanceof Error
              ? err.message
              : '위치 감시 시작 실패';
        setMoveStatus(`${message} · 30초 주기만 사용`);
      });

    return () => {
      cancelled = true;
      clearInterval(pollId);
      subscription?.remove();
    };
    // Seed fingerprint once when enabling; complexes intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveWatchOn, runMoveCheck]);

  useEffect(() => {
    return () => stopNarration();
  }, []);

  const onToggleNarration = () => {
    if (narrationOn) {
      setNarrationOn(false);
      return;
    }
    narrationFingerprint.current = null;
    setNarrationOn(true);
  };

  const onToggleMoveWatch = () => {
    setMoveWatchOn((prev) => !prev);
  };

  const onChangeAreaTarget = (next: number | undefined) => {
    narrationFingerprint.current = null;
    announcedTop3Key.current = null;
    setAreaTarget(next);
  };

  const onChangeSearchScope = (scope: NearbySearchScope) => {
    narrationFingerprint.current = null;
    announcedTop3Key.current = null;
    void updateNearbySettings({ scope });
  };

  const areaNavParam = areaTarget !== undefined ? String(areaTarget) : undefined;
  const areaFilterLabel =
    areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : '전체 면적';
  const searchScopeLabel = scopeLabel(nearbySettings);

  const mapMarkers = useMemo(() => buildStyledMapMarkers(complexes, 60), [complexes]);
  const mapHeatPoints = useMemo(() => buildPyeongHeatPoints(complexes, 60), [complexes]);
  const rankedList = useMemo(() => sortBySalePriceDesc(complexes).slice(0, 8), [complexes]);

  const lat =
    (followUser ? userLoc?.lat : null) ??
    activeLoc?.lat ??
    activeAddress?.lat ??
    37.5665;
  const lng =
    (followUser ? userLoc?.lng : null) ??
    activeLoc?.lng ??
    activeAddress?.lng ??
    126.978;
  const usingMapFocus = mapFocus !== null;
  const mapMarkerLimit = mapFullscreen ? 60 : 20;
  const fullscreenMapHeight = Math.max(
    320,
    windowHeight - insets.top - insets.bottom - 52,
  );

  const openMapFullscreen = useCallback(() => {
    setMapPriceMode('sale');
    setMapFullscreen(true);
  }, []);

  const closeMapFullscreen = useCallback(() => {
    setMapFullscreen(false);
  }, []);

  const radiusMeters =
    nearbySettings.scope === 'radius' ? nearbySettings.radiusKm * 1000 : null;
  const radiusCenterLat =
    nearbySettings.scope === 'radius' ? (mapFocus?.lat ?? userLoc?.lat ?? null) : null;
  const radiusCenterLng =
    nearbySettings.scope === 'radius' ? (mapFocus?.lng ?? userLoc?.lng ?? null) : null;

  const mapOverlayControls = (opts?: { showExpand?: boolean }) => (
    <>
      <View style={styles.mapAreaChips} pointerEvents="box-none">
        <AreaBandChips
          overlay
          value={areaTarget}
          onChange={onChangeAreaTarget}
          availableTargets={availableAreaTargets}
        />
      </View>
      <View style={styles.mapMetricToggle} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="시세로 보기"
          onPress={() => setMapPriceMode('sale')}
          style={[styles.mapMetricChip, mapPriceMode === 'sale' && styles.mapMetricChipOn]}
        >
          <Text
            style={[styles.mapMetricChipText, mapPriceMode === 'sale' && styles.mapMetricChipTextOn]}
          >
            시세
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="평단가로 보기"
          onPress={() => setMapPriceMode('pyeong')}
          style={[styles.mapMetricChip, mapPriceMode === 'pyeong' && styles.mapMetricChipOn]}
        >
          <Text
            style={[
              styles.mapMetricChipText,
              mapPriceMode === 'pyeong' && styles.mapMetricChipTextOn,
            ]}
          >
            평단가
          </Text>
        </Pressable>
      </View>
      <View style={styles.mapBottomLeft} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="현재 위치로 이동"
          style={[
            styles.mapIconBtn,
            !followUser && styles.locateBtnActive,
            investigating && styles.locateBtnDisabled,
          ]}
          disabled={investigating}
          onPress={() => void goToMyLocation()}
        >
          <Text style={styles.mapIconGlyph}>◎</Text>
        </Pressable>
        {opts?.showExpand ? (
          <Pressable
            accessibilityLabel="맵 전체보기"
            style={styles.mapIconBtn}
            onPress={openMapFullscreen}
          >
            <Text style={styles.mapIconGlyph}>⤢</Text>
          </Pressable>
        ) : null}
      </View>
      {investigating || (listLoading && usingMapFocus) ? (
        <View style={styles.mapBusy}>
          <Text style={styles.mapBusyText}>이 위치 시세 조회 중…</Text>
        </View>
      ) : null}
    </>
  );

  const moveHint = moveWatchOn
    ? moveStatus ?? '100m 이동 또는 30초마다 Top 3 변동을 확인합니다'
    : 'Off · 켜면 이동 시 Top 3 변화를 소리로 알려줍니다';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c45c26" />}
    >
      <Stack.Screen
        options={{
          title: 'App Navi',
          headerRight: () => (
            <View style={styles.headerRight}>
              <GapGapGapLinkButton compact />
              <Pressable
                accessibilityLabel="설정"
                onPress={() => router.push('/settings')}
                style={styles.settingsHeaderBtn}
              >
                <Text style={styles.settingsHeaderText}>설정</Text>
              </Pressable>
              <PwaInstallButton
                compact
                installed={pwa.isInstalled}
                installing={pwa.installing}
                waitingForPrompt={pwa.waitingForPrompt}
                onPress={() => {
                  pwa.clearMessage();
                  void pwa.install();
                }}
              />
            </View>
          ),
        }}
      />

      <View style={styles.mapShell}>
        {!mapFullscreen ? (
          <KakaoMapView
            lat={lat}
            lng={lng}
            jsKey={jsKey}
            markers={mapMarkers}
            heatPoints={mapHeatPoints}
            mapPriceMode={mapPriceMode}
            markerLimit={mapMarkerLimit}
            height={360}
            userLat={userLoc?.lat ?? null}
            userLng={userLoc?.lng ?? null}
            userHeading={userLoc?.heading ?? null}
            followUser={followUser && !usingMapFocus}
            focusLat={mapFocus?.lat ?? null}
            focusLng={mapFocus?.lng ?? null}
            radiusMeters={radiusMeters}
            radiusCenterLat={radiusCenterLat}
            radiusCenterLng={radiusCenterLng}
            onLongPressLocation={(plat, plng) => void investigateAt(plat, plng)}
            onUserInteract={onMapUserInteract}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>맵 전체보기 중</Text>
          </View>
        )}
        {!mapFullscreen ? mapOverlayControls({ showExpand: true }) : null}
      </View>

      <Modal
        visible={mapFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMapFullscreen}
      >
        <View style={[styles.fullscreenRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.fullscreenHeader}>
            <FullscreenTextCardToggle
              enabled={textCardsOn}
              onToggle={setTextCardsOn}
              settings={narrationSettings}
              canEnable={narration.top3.length > 0}
            />
            <Pressable
              accessibilityLabel="맵 전체보기 닫기"
              onPress={closeMapFullscreen}
              style={styles.fullscreenCloseBtn}
            >
              <Text style={styles.fullscreenCloseText}>닫기</Text>
            </Pressable>
          </View>
          <View style={styles.fullscreenMapShell}>
            <KakaoMapView
              lat={lat}
              lng={lng}
              jsKey={jsKey}
              markers={mapMarkers}
              heatPoints={mapHeatPoints}
              mapPriceMode={mapPriceMode}
              markerLimit={mapMarkerLimit}
              height={fullscreenMapHeight}
              style={styles.fullscreenMap}
              userLat={userLoc?.lat ?? null}
              userLng={userLoc?.lng ?? null}
              userHeading={userLoc?.heading ?? null}
              followUser={followUser && !usingMapFocus}
              focusLat={mapFocus?.lat ?? null}
              focusLng={mapFocus?.lng ?? null}
              radiusMeters={radiusMeters}
              radiusCenterLat={radiusCenterLat}
              radiusCenterLng={radiusCenterLng}
              onLongPressLocation={(plat, plng) => void investigateAt(plat, plng)}
              onUserInteract={onMapUserInteract}
            />
            {mapOverlayControls({ showExpand: false })}
            <FullscreenTextCardOverlay
              enabled={textCardsOn}
              narration={narration}
            />
            {narrationOn ? (
              <View style={styles.fullscreenNarration} pointerEvents="none">
                <Text style={styles.fullscreenNarrationText}>
                  {speaking
                    ? `나레이션 · ${narrationSettingsHint(narrationSettings)} 읽는 중…`
                    : `나레이션 On · ${narrationSettingsHint(narrationSettings)}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <AddressCard
        address={activeAddress}
        loading={loading || investigating}
        searchSettings={nearbySettings}
      />
      <SearchScopeChips
        scope={nearbySettings.scope}
        radiusKm={nearbySettings.radiusKm}
        onChange={onChangeSearchScope}
        onPressRadiusSettings={() => router.push('/settings')}
      />
      {usingMapFocus ? (
        <Text style={styles.focusHint}>
          {nearbySettings.scope === 'radius'
            ? `선택한 지점 기준 반경 ${formatRadiusLabel(nearbySettings.radiusKm)}로 매매가를 조사합니다`
            : '선택한 지점의 시군구(구·시·군) 범위로 매매가를 조사합니다'}
        </Text>
      ) : (
        <Text style={styles.focusHint}>
          {nearbySettings.scope === 'radius'
            ? `현재 위치 반경 ${formatRadiusLabel(nearbySettings.radiusKm)} 안 단지를 찾습니다 · 설정에서 반경 변경`
            : '현재 위치 또는 길게 누른 지점의 시군구(구·시·군) 단위로 매매가를 조사합니다'}
        </Text>
      )}
      <ErrorBanner message={error ?? listError} />
      <ErrorBanner message={pwa.message} tone="info" />

      <PwaInstallPrompt
        visible={pwa.showFirstVisit}
        installing={pwa.installing}
        waitingForPrompt={pwa.waitingForPrompt}
        canPromptNative={pwa.canPromptNative}
        isIos={pwa.isIos}
        isInAppBrowser={pwa.isInAppBrowser}
        onInstall={() => void pwa.install()}
        onDismiss={() => void pwa.dismissFirstVisit()}
      />

      <NarrationToggle
        enabled={narrationOn}
        speaking={speaking}
        disabled={listLoading && complexes.length === 0}
        hint={
          narrationOn
            ? speaking
              ? `${narrationSettingsHint(narrationSettings)} 읽는 중…`
              : `On · ${narrationSettingsHint(narrationSettings)}`
            : undefined
        }
        onToggle={onToggleNarration}
        onPressSettings={() => router.push('/narration-settings')}
      />

      <FeatureToggle
        title="이동시 인식"
        enabled={moveWatchOn}
        hint={moveHint}
        disabled={!location && !address}
        onToggle={onToggleMoveWatch}
        activeColor="#1a2332"
      />

      {(narrationOn || moveWatchOn || showTop3Card) && narration.top3.length > 0 ? (
        <View style={styles.narrationCard}>
          <Text style={styles.narrationTitle}>
            매매가 Top {narration.topCount} · {areaFilterLabel}
          </Text>
          {narration.top3.map((c, i) => (
            <Text key={c.id} style={styles.narrationRow}>
              {i + 1}. {c.aptName} · {formatManwonSpoken(c.medianPrice)}
              {c.changePercent !== null
                ? ` · ${c.changePercent > 0 ? '+' : ''}${c.changePercent.toFixed(1)}%`
                : ''}
              {c.saleJeonseGap !== null ? ` · 갭 ${formatManwonSpoken(c.saleJeonseGap)}` : ''}
            </Text>
          ))}
          <Text style={styles.narrationAvg}>
            나레이션 {narrationSettingsHint(narrationSettings)}
            {' · '}
            매매 {narration.avgSale !== null ? formatManwonSpoken(narration.avgSale) : '-'}
            {' · '}
            전세 {narration.avgJeonse !== null ? formatManwonSpoken(narration.avgJeonse) : '-'}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => void goToMyLocation()}>
          <Text style={styles.primaryBtnText}>내 위치로</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            if (!activeAddress) return;
            router.push({
              pathname: '/complexes',
              params: {
                lawdCd: activeAddress.lawdCd,
                lat: String(lat),
                lng: String(lng),
                region:
                  nearbySettings.scope === 'radius'
                    ? `반경 ${formatRadiusLabel(nearbySettings.radiusKm)}`
                    : activeAddress.sigunguLabel ??
                      `${activeAddress.region1} ${activeAddress.region2}`,
                scope: nearbySettings.scope,
                ...(nearbySettings.scope === 'radius'
                  ? { radiusKm: String(nearbySettings.radiusKm) }
                  : {}),
                ...(areaNavParam ? { areaTarget: areaNavParam } : {}),
              },
            });
          }}
          disabled={!activeAddress}
        >
          <Text style={styles.secondaryBtnText}>전체 단지 보기</Text>
        </Pressable>
      </View>
      <GapGapGapLinkButton />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>주변 단지 시세</Text>
        <Text style={styles.sectionSub}>
          {searchScopeLabel} · 매매가 높은 순 · 최근 3개월 · {areaFilterLabel}
        </Text>
      </View>

      {listLoading && complexes.length === 0 ? (
        <LoadingBlock label="실거래가를 집계하는 중…" />
      ) : (
        <ComplexList
          items={rankedList}
          emptyMessage={
            nearbySettings.scope === 'radius'
              ? areaTarget !== undefined
                ? `반경 ${formatRadiusLabel(nearbySettings.radiusKm)} 안 ${areaFilterLabel} 최근 실거래가 없습니다.`
                : `반경 ${formatRadiusLabel(nearbySettings.radiusKm)} 안 최근 아파트 실거래가 없습니다.`
              : areaTarget !== undefined
                ? `이 지역에 ${areaFilterLabel} 최근 실거래가 없습니다.`
                : '이 지역에 최근 아파트 실거래가 없습니다.'
          }
          onPress={(item) =>
            router.push({
              pathname: '/complex/[id]',
              params: {
                id: encodeURIComponent(item.id),
                lawdCd: activeAddress?.lawdCd ?? '',
                aptName: item.aptName,
                dong: item.dong,
                ...(areaNavParam ? { areaTarget: areaNavParam } : {}),
              },
            })
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f1ea',
  },
  mapShell: {
    position: 'relative',
  },
  mapPlaceholder: {
    height: 360,
    backgroundColor: '#e8eef4',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d5dbe3',
  },
  mapPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5c6670',
  },
  fullscreenRoot: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  fullscreenHeader: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fullscreenTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  fullscreenCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  fullscreenCloseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  fullscreenMapShell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#e8eef4',
    overflow: 'hidden',
  },
  fullscreenMap: {
    borderBottomWidth: 0,
  },
  fullscreenNarration: {
    position: 'absolute',
    left: 10,
    right: 12,
    bottom: 62,
    zIndex: 8,
    alignItems: 'flex-start',
  },
  fullscreenNarrationText: {
    backgroundColor: 'rgba(26, 35, 50, 0.88)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerRight: {
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  settingsHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  settingsHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2332',
  },
  mapAreaChips: {
    position: 'absolute',
    left: 8,
    right: 118,
    top: 8,
    zIndex: 6,
  },
  mapMetricToggle: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 7,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  mapMetricChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mapMetricChipOn: {
    backgroundColor: '#1a2332',
  },
  mapMetricChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5c6670',
  },
  mapMetricChipTextOn: {
    color: '#fff',
  },
  mapBottomLeft: {
    position: 'absolute',
    left: 10,
    bottom: 14,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 35, 50, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  locateBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
  },
  locateBtnDisabled: {
    opacity: 0.5,
  },
  mapIconGlyph: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  mapBusy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 64,
    alignItems: 'center',
    zIndex: 5,
  },
  mapBusyText: {
    backgroundColor: 'rgba(26, 35, 50, 0.85)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    textAlign: 'center',
    overflow: 'hidden',
  },
  focusHint: {
    marginHorizontal: 16,
    marginTop: 8,
    fontSize: 12,
    color: '#6b7580',
  },
  narrationCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff8f2',
    borderWidth: 1,
    borderColor: '#e8c9b4',
  },
  narrationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c45c26',
    marginBottom: 6,
  },
  narrationRow: {
    fontSize: 13,
    color: '#1a2332',
    lineHeight: 20,
  },
  narrationAvg: {
    marginTop: 8,
    fontSize: 12,
    color: '#5c6670',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#1a2332',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7c4b0',
  },
  secondaryBtnText: {
    color: '#1a2332',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionHead: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2332',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7580',
  },
});
