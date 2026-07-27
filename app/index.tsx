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
import { ComplexList } from '../src/components/ComplexList';
import { ErrorBanner } from '../src/components/ErrorBanner';
import { KakaoMapView } from '../src/components/KakaoMapView';
import { LoadingBlock } from '../src/components/LoadingBlock';
import { NarrationToggle } from '../src/components/NarrationToggle';
import { useCurrentLocation } from '../src/hooks/useCurrentLocation';
import { fetchKakaoJsKey, fetchNearbyComplexes } from '../src/services/api';
import { speakNarration, stopNarration } from '../src/services/speech';
import type { ComplexSummary } from '../src/types';
import { buildNearbyNarration, formatManwonSpoken } from '../src/utils/narration';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, address, loading, error, refresh } = useCurrentLocation();
  const [jsKey, setJsKey] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<ComplexSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [narrationOn, setNarrationOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const narrationFingerprint = useRef<string | null>(null);

  useEffect(() => {
    void fetchKakaoJsKey()
      .then(setJsKey)
      .catch(() => setJsKey(null));
  }, []);

  const loadComplexes = useCallback(async () => {
    if (!address?.lawdCd || !location) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetchNearbyComplexes({
        lawdCd: address.lawdCd,
        months: 3,
        enrichCoords: true,
        lat: location.lat,
        lng: location.lng,
      });
      setComplexes(res.complexes.slice(0, 20));
    } catch (err) {
      setListError(err instanceof Error ? err.message : '시세 조회 실패');
    } finally {
      setListLoading(false);
    }
  }, [address?.lawdCd, location]);

  useEffect(() => {
    void loadComplexes();
  }, [loadComplexes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await loadComplexes();
    setRefreshing(false);
  }, [refresh, loadComplexes]);

  const narration = useMemo(() => buildNearbyNarration(complexes), [complexes]);

  const playNarration = useCallback(
    (force = false) => {
      if (complexes.length === 0) return;
      const fingerprint = narration.script;
      if (!force && narrationFingerprint.current === fingerprint) return;
      narrationFingerprint.current = fingerprint;
      setSpeaking(true);
      speakNarration(narration.script, {
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [complexes.length, narration.script],
  );

  useEffect(() => {
    if (!narrationOn) {
      stopNarration();
      setSpeaking(false);
      narrationFingerprint.current = null;
      return;
    }
    if (listLoading || complexes.length === 0) return;
    playNarration();
  }, [narrationOn, listLoading, complexes.length, playNarration]);

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

  const mapMarkers = useMemo(
    () =>
      complexes
        .filter((c) => c.lat && c.lng)
        .slice(0, 12)
        .map((c) => ({ lat: c.lat!, lng: c.lng!, title: c.aptName })),
    [complexes],
  );

  const lat = location?.lat ?? address?.lat ?? 37.5665;
  const lng = location?.lng ?? address?.lng ?? 126.978;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c45c26" />}
    >
      <KakaoMapView lat={lat} lng={lng} jsKey={jsKey} markers={mapMarkers} height={340} />

      <AddressCard address={address} loading={loading} />
      <ErrorBanner message={error ?? listError} />

      <NarrationToggle
        enabled={narrationOn}
        speaking={speaking}
        disabled={listLoading && complexes.length === 0}
        onToggle={onToggleNarration}
      />

      {narrationOn && narration.top3.length > 0 ? (
        <View style={styles.narrationCard}>
          <Text style={styles.narrationTitle}>매매가 Top 3</Text>
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
        <Text style={styles.sectionSub}>동일 시군구 · 최근 3개월 실거래 기준</Text>
      </View>

      {listLoading && complexes.length === 0 ? (
        <LoadingBlock label="실거래가를 집계하는 중…" />
      ) : (
        <ComplexList
          items={complexes.slice(0, 8)}
          emptyMessage="이 지역에 최근 아파트 실거래가 없습니다."
          onPress={(item) =>
            router.push({
              pathname: '/complex/[id]',
              params: {
                id: encodeURIComponent(item.id),
                lawdCd: address?.lawdCd ?? '',
                aptName: item.aptName,
                dong: item.dong,
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
