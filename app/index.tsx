import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressCard } from '../src/components/AddressCard';
import { AreaBandChips } from '../src/components/AreaBandChips';
import { ComplexList } from '../src/components/ComplexList';
import { ErrorBanner } from '../src/components/ErrorBanner';
import { FeatureToggle } from '../src/components/FeatureToggle';
import { KakaoMapView } from '../src/components/KakaoMapView';
import { LoadingBlock } from '../src/components/LoadingBlock';
import { NarrationToggle } from '../src/components/NarrationToggle';
import { PwaInstallButton, PwaInstallPrompt } from '../src/components/PwaInstall';
import { useCurrentLocation } from '../src/hooks/useCurrentLocation';
import { usePwaInstall } from '../src/hooks/usePwaInstall';
import { fetchKakaoJsKey, fetchNearbyComplexes, reverseGeocode } from '../src/services/api';
import { getNearbyCache, setNearbyCache } from '../src/services/nearbyCache';
import {
  getCurrentLocation,
  LocationError,
  watchLiveLocation,
  watchLocationChanges,
} from '../src/services/location';
import { speakNarration, stopNarration } from '../src/services/speech';
import type { ComplexSummary, ReverseGeocodeResult, UserLocation } from '../src/types';
import { formatAreaBandLabel } from '../src/utils/areaBands';
import { confirmMapInvestigate } from '../src/utils/confirm';
import { distanceMeters } from '../src/utils/geo';
import { buildStyledMapMarkers, sortBySalePriceDesc } from '../src/utils/mapMarkers';
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
  const { location, address, loading, error, refresh } = useCurrentLocation();
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
  const [investigating, setInvestigating] = useState(false);
  const [showTop3Card, setShowTop3Card] = useState(false);
  /** Live GPS for the blue map marker (updated more often than address refresh). */
  const [liveLocation, setLiveLocation] = useState<UserLocation | null>(null);
  /** Keep map centered on GPS until the user pans (or investigates prices). */
  const [followUser, setFollowUser] = useState(true);

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
  const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True after a successful 매매가 investigate — blocks 15s auto-return until locate is pressed. */
  const priceLockRef = useRef(false);

  locationRef.current = location;
  addressRef.current = address;
  areaTargetRef.current = areaTarget;
  mapFocusRef.current = mapFocus;
  mapAddressRef.current = mapAddress;

  const userLoc = liveLocation ?? location;
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
  const onMapUserInteract = useCallback(() => {
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
        });
        const ranked = sortBySalePriceDesc(res.complexes).slice(0, 20);
        setComplexes(ranked);
        const bandTargets = res.areaBands?.map((b) => b.targetM2) ?? [];
        if (bandTargets.length) setAvailableAreaTargets(bandTargets);
        // Cache GPS-based results for "현재 위치" quick restore (server cache still used on fetch).
        if (!mapFocusRef.current) {
          setNearbyCache({
            lawdCd,
            areaTarget: selectedArea,
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
    if (!activeAddress?.lawdCd || !activeLoc) return;
    if (skipAutoLoad.current) {
      skipAutoLoad.current = false;
      return;
    }
    void loadComplexes({
      lawdCd: activeAddress.lawdCd,
      lat: activeLoc.lat,
      lng: activeLoc.lng,
    });
  }, [loadComplexes, activeAddress?.lawdCd, activeLoc?.lat, activeLoc?.lng, areaTarget]);

  const goToMyLocation = useCallback(async () => {
    setInvestigating(true);
    setListError(null);
    try {
      resumeFollowMyLocation();
      const loc = await getCurrentLocation();
      setLiveLocation(loc);
      const geo = await reverseGeocode(loc.lat, loc.lng);
      const cached = getNearbyCache(geo.lawdCd, areaTargetRef.current);
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
      const ok = await confirmMapInvestigate();
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
      ),
    [complexes, areaTarget],
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
      announcedTop3Key.current = top3Fingerprint(narration.top3);
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
    if (listLoading || complexes.length === 0) return;
    playNarration();
    // Re-speak on toggle / area change / first ready data; move-watch handles Top3 change announces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationOn, listLoading, areaTarget, complexes.length]);

  // After a move-triggered reload, announce only if Top 3 changed.
  useEffect(() => {
    if (!pendingMoveCheck.current || !moveWatchOn) return;
    pendingMoveCheck.current = false;

    const key = top3Fingerprint(narration.top3);
    if (announcedTop3Key.current !== null && key === announcedTop3Key.current) {
      setMoveStatus('이동 확인 · Top 3 변동 없음');
      return;
    }

    announcedTop3Key.current = key;
    narrationFingerprint.current = narration.script;
    setMoveStatus(
      narration.top3.length > 0
        ? '이동 감지 · Top 3 갱신, 다시 읽어줍니다'
        : '이동 확인 · 주변 매매 단지 없음',
    );
    speakScript(buildTop3ChangedScript(narration));
  }, [complexes, narration, speakScript, moveWatchOn]);

  // Long-press investigate: speak Top 3 once data is ready.
  useEffect(() => {
    if (!pendingSpeakTop3.current) return;
    if (listLoading || investigating) return;
    pendingSpeakTop3.current = false;
    const stats = buildNearbyNarration(
      complexes,
      areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : undefined,
    );
    narrationFingerprint.current = stats.script;
    announcedTop3Key.current = top3Fingerprint(stats.top3);
    setShowTop3Card(true);
    if (stats.top3.length === 0) {
      speakScript(stats.script);
      return;
    }
    speakScript(buildTop3InvestigateScript(stats));
  }, [complexes, listLoading, investigating, areaTarget, speakScript]);

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
    announcedTop3Key.current = top3Fingerprint(buildNearbyNarration(complexes).top3);
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

  const areaNavParam = areaTarget !== undefined ? String(areaTarget) : undefined;
  const areaFilterLabel =
    areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : '전체 면적';

  const mapMarkers = useMemo(() => buildStyledMapMarkers(complexes, 20), [complexes]);
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
              <PwaInstallButton
                compact
                installed={pwa.isInstalled}
                installing={pwa.installing}
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
        <KakaoMapView
          lat={lat}
          lng={lng}
          jsKey={jsKey}
          markers={mapMarkers}
          height={360}
          userLat={userLoc?.lat ?? null}
          userLng={userLoc?.lng ?? null}
          userHeading={userLoc?.heading ?? null}
          followUser={followUser && !usingMapFocus}
          focusLat={mapFocus?.lat ?? null}
          focusLng={mapFocus?.lng ?? null}
          onLongPressLocation={(plat, plng) => void investigateAt(plat, plng)}
          onUserInteract={onMapUserInteract}
        />
        <View style={styles.mapAreaChips} pointerEvents="box-none">
          <AreaBandChips
            overlay
            value={areaTarget}
            onChange={onChangeAreaTarget}
            availableTargets={availableAreaTargets}
          />
        </View>
        <Pressable
          accessibilityLabel="현재 위치로 이동"
          style={[
            styles.locateBtn,
            !followUser && styles.locateBtnActive,
            investigating && styles.locateBtnDisabled,
          ]}
          disabled={investigating}
          onPress={() => void goToMyLocation()}
        >
          <Text style={styles.locateBtnGlyph}>◎</Text>
        </Pressable>
        {investigating || (listLoading && usingMapFocus) ? (
          <View style={styles.mapBusy}>
            <Text style={styles.mapBusyText}>이 위치 시세 조회 중…</Text>
          </View>
        ) : null}
      </View>

      <AddressCard address={activeAddress} loading={loading || investigating} />
      {usingMapFocus ? (
        <Text style={styles.focusHint}>
          선택한 지점의 시군구(구·시·군) 범위로 매매가를 조사합니다
        </Text>
      ) : (
        <Text style={styles.focusHint}>
          현재 위치 또는 길게 누른 지점의 시군구(구·시·군) 단위로 매매가를 조사합니다
        </Text>
      )}
      <ErrorBanner message={error ?? listError} />
      <ErrorBanner message={pwa.message} tone="info" />

      <PwaInstallPrompt
        visible={pwa.showFirstVisit}
        installing={pwa.installing}
        isIos={pwa.isIos}
        onInstall={() => void pwa.install()}
        onDismiss={() => void pwa.dismissFirstVisit()}
      />

      <NarrationToggle
        enabled={narrationOn}
        speaking={speaking}
        disabled={listLoading && complexes.length === 0}
        onToggle={onToggleNarration}
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
          <Text style={styles.narrationTitle}>매매가 Top 3 · {areaFilterLabel}</Text>
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
                  activeAddress.sigunguLabel ??
                  `${activeAddress.region1} ${activeAddress.region2}`,
                ...(areaNavParam ? { areaTarget: areaNavParam } : {}),
              },
            });
          }}
          disabled={!activeAddress}
        >
          <Text style={styles.secondaryBtnText}>전체 단지 보기</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>주변 단지 시세</Text>
        <Text style={styles.sectionSub}>
          시군구(구·시·군) 단위 · 매매가 높은 순 · 최근 3개월 · {areaFilterLabel}
        </Text>
      </View>

      {listLoading && complexes.length === 0 ? (
        <LoadingBlock label="실거래가를 집계하는 중…" />
      ) : (
        <ComplexList
          items={rankedList}
          emptyMessage={
            areaTarget !== undefined
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
  headerRight: {
    marginRight: 8,
    justifyContent: 'center',
  },
  mapAreaChips: {
    position: 'absolute',
    left: 8,
    right: 52,
    top: 8,
    zIndex: 6,
  },
  locateBtn: {
    position: 'absolute',
    left: 10,
    bottom: 14,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 35, 50, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
  },
  locateBtnDisabled: {
    opacity: 0.5,
  },
  locateBtnGlyph: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  mapBusy: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: 12,
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
