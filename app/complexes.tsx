import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AreaBandChips } from '../src/components/AreaBandChips';
import { ComplexList } from '../src/components/ComplexList';
import { ErrorBanner } from '../src/components/ErrorBanner';
import { LoadingBlock } from '../src/components/LoadingBlock';
import { fetchNearbyComplexes } from '../src/services/api';
import type { ComplexSummary } from '../src/types';
import { formatAreaBandLabel } from '../src/utils/areaBands';
import { sortBySalePriceDesc } from '../src/utils/mapMarkers';

export default function ComplexesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lawdCd?: string;
    lat?: string;
    lng?: string;
    region?: string;
    areaTarget?: string;
  }>();

  const initialArea = params.areaTarget ? Number(params.areaTarget) : undefined;
  const [query, setQuery] = useState('');
  const [areaTarget, setAreaTarget] = useState<number | undefined>(
    Number.isFinite(initialArea) ? initialArea : undefined,
  );
  const [availableAreaTargets, setAvailableAreaTargets] = useState<number[]>([]);
  const [items, setItems] = useState<ComplexSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const next = params.areaTarget ? Number(params.areaTarget) : undefined;
    setAreaTarget(Number.isFinite(next as number) ? next : undefined);
  }, [params.areaTarget]);

  const load = useCallback(async () => {
    if (!params.lawdCd) {
      setError('법정동코드가 없습니다. 홈에서 위치를 다시 확인해 주세요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNearbyComplexes({
        lawdCd: params.lawdCd,
        months: 3,
        q: query.trim() || undefined,
        areaTarget,
        enrichCoords: false,
        lat: params.lat ? Number(params.lat) : undefined,
        lng: params.lng ? Number(params.lng) : undefined,
      });
      setItems(sortBySalePriceDesc(res.complexes));
      if (res.areaBands?.length) {
        setAvailableAreaTargets(res.areaBands.map((b) => b.targetM2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '시세 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [params.lawdCd, params.lat, params.lng, query, areaTarget]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const areaNavParam = areaTarget !== undefined ? String(areaTarget) : undefined;
  const areaLabel = areaTarget !== undefined ? formatAreaBandLabel(areaTarget) : '전체 면적';

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c45c26" />}
    >
      <View style={styles.header}>
        <Text style={styles.region}>{params.region ?? `법정동 ${params.lawdCd}`}</Text>
        <Text style={styles.hint}>단지명·동으로 검색하거나 면적대를 골라 보세요.</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="단지명 또는 동 검색"
          placeholderTextColor="#9aa3ad"
          style={styles.input}
          autoCorrect={false}
        />
        <AreaBandChips
          embedded
          value={areaTarget}
          onChange={setAreaTarget}
          availableTargets={availableAreaTargets}
          hint={`현재 필터: ${areaLabel}`}
        />
      </View>

      <ErrorBanner message={error} />

      {loading && items.length === 0 ? (
        <LoadingBlock />
      ) : (
        <ComplexList
          items={items}
          emptyMessage="조건에 맞는 단지가 없습니다."
          onPress={(item) =>
            router.push({
              pathname: '/complex/[id]',
              params: {
                id: encodeURIComponent(item.id),
                lawdCd: params.lawdCd ?? '',
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
  header: {
    padding: 16,
    gap: 8,
  },
  region: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2332',
  },
  hint: {
    fontSize: 13,
    color: '#6b7580',
  },
  input: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7c4b0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a2332',
  },
});
