import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import {
  getCurrentLocation,
  LocationError,
  watchLocationChanges,
} from '../src/services/location';
import { speakNarration, stopNarration } from '../src/services/speech';
import type { ComplexSummary, UserLocation } from '../src/types';
import { formatAreaBandLabel } from '../src/utils/areaBands';
import { distanceMeters } from '../src/utils/geo';
import { buildStyledMapMarkers } from '../src/utils/mapMarkers';
import {
  buildNearbyNarration,
  buildTop3ChangedScript,
  formatManwonSpoken,
  top3Fingerprint,
} from '../src/utils/narration';

const MOVE_THRESHOLD_M = 100;
const MOVE_POLL_MS = 30_000;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, address, loading, error, refresh } = useCurrentLocation();
  const pwa = usePwaInstall();
  const [jsKey, setJsKey] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<ComplexSummary[]>([]);
  const [availableAreaTargets, setAvailableAreaTargets] = useState<number[]>([]);
  const [areaTarget, setAreaTarget] = useState<number | undefined>(undefined);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [narrationOn, setNarrationOn] = useState(false);
  const [moveWatchOn, setMoveWatchOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [moveStatus, setMoveStatus] = useState<string | null>(null);

  const narrationFingerprint = useRef<string | null>(null);
  const announcedTop3Key = useRef<string | null>(null);
  const anchorLoc = useRef<UserLocation | null>(null);
  const pendingMoveCheck = useRef(false);
  const moveBusy = useRef(false);
  const locationRef = useRef(location);
  const addressRef = useRef(address);
  const areaTargetRef = useRef(areaTarget);

  locationRef.current = location;
  addressRef.current = address;
  areaTargetRef.current = areaTarget;

  useEffect(() => {
    void fetchKakaoJsKey()
      .then(setJsKey)
      .catch(() => setJsKey(null));
  }, []);

  const loadComplexes = useCallback(
    async (opts?: {
      lawdCd?: string;
      lat?: number;
      lng?: number;
      quiet?: boolean;
      areaTarget?: number;
    }) => {
      const lawdCd = opts?.lawdCd ?? addressRef.current?.lawdCd;
      const lat = opts?.lat ?? locationRef.current?.lat;
      const lng = opts?.lng ?? locationRef.current?.lng;
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
        setComplexes(res.complexes.slice(0, 20));
        if (res.areaBands?.length) {
          setAvailableAreaTargets(res.areaBands.map((b) => b.targetM2));
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
    void loadComplexes();
  }, [loadComplexes, address?.lawdCd, location?.lat, location?.lng, areaTarget]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await loadComplexes();
    setRefreshing(false);
  }, [refresh, loadComplexes]);

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
  }, [loadComplexes, refresh]);

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

  const mapMarkers = useMemo(() => buildStyledMapMarkers(complexes, 12), [complexes]);

  const lat = location?.lat ?? address?.lat ?? 37.5665;
  const lng = location?.lng ?? address?.lng ?? 126.978;

  const moveHint = moveWatchOn
    ? moveStatus ?? '100m 이동 또는 30초마다 Top 3 변동을 확인합니다'
    : 'Off · 켜면 이동 시 Top 3 변화를 소리로 알려줍니다';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c45c26" />}
    >
      <KakaoMapView lat={lat} lng={lng} jsKey={jsKey} markers={mapMarkers} height={340} />

      <AddressCard address={address} loading={loading} />
      <ErrorBanner message={error ?? listError} />
      <ErrorBanner message={pwa.message} tone="info" />

      <PwaInstallButton
        installed={pwa.isInstalled}
        installing={pwa.installing}
        onPress={() => {
          pwa.clearMessage();
          void pwa.install();
        }}
      />

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

      <AreaBandChips
        value={areaTarget}
        onChange={onChangeAreaTarget}
        availableTargets={availableAreaTargets}
      />

      {(narrationOn || moveWatchOn) && narration.top3.length > 0 ? (
        <View style={styles.narrationCard}>
          <Text style={styles.narrationTitle}>매매가 Top 3 · {areaFilterLabel}</Text>
          {narration.top3.map((c, i) => (
            <Text key={c.id} style={styles.narrationRow}>
              {i + 1}. {c.aptName} · {formatManwonSpoken(c.medianPrice)}
            </Text>
          ))}
          <Text style={styles.narrationAvg}>
            매매 평균 {narration.avgSale !== null ? formatManwonSpoken(narration.avgSale) : '-'}
            {' · '}
            전세 평균 {narration.avgJeonse !== null ? formatManwonSpoken(narration.avgJeonse) : '-'}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => void refresh()}>
          <Text style={styles.primaryBtnText}>내 위치로</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            if (!address) return;
            router.push({
              pathname: '/complexes',
              params: {
                lawdCd: address.lawdCd,
                lat: String(lat),
                lng: String(lng),
                region: `${address.region1} ${address.region2}`,
                ...(areaNavParam ? { areaTarget: areaNavParam } : {}),
              },
            });
          }}
          disabled={!address}
        >
          <Text style={styles.secondaryBtnText}>전체 단지 보기</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>주변 단지 시세</Text>
        <Text style={styles.sectionSub}>
          동일 시군구 · 최근 3개월 · {areaFilterLabel}
        </Text>
      </View>

      {listLoading && complexes.length === 0 ? (
        <LoadingBlock label="실거래가를 집계하는 중…" />
      ) : (
        <ComplexList
          items={complexes.slice(0, 8)}
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
                lawdCd: address?.lawdCd ?? '',
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
