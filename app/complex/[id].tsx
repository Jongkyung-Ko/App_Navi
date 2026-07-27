import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { LoadingBlock } from '../../src/components/LoadingBlock';
import { TrendChart } from '../../src/components/TrendChart';
import { fetchComplexDetail } from '../../src/services/api';
import type { ComplexSummary } from '../../src/types';
import { changeColor, formatArea, formatManwon, formatPyeongPrice } from '../../src/utils/format';

export default function ComplexDetailScreen() {
  const params = useLocalSearchParams<{
    lawdCd?: string;
    aptName?: string;
    dong?: string;
    areaTarget?: string;
  }>();

  const [complex, setComplex] = useState<ComplexSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!params.lawdCd || !params.aptName) {
      setError('단지 정보가 없습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchComplexDetail({
        lawdCd: params.lawdCd,
        aptName: params.aptName,
        dong: params.dong,
        months: 6,
        areaTarget: params.areaTarget ? Number(params.areaTarget) : undefined,
      });
      setComplex(res.complex);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상세 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [params.lawdCd, params.aptName, params.dong, params.areaTarget]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !complex) {
    return <LoadingBlock label="단지 동향을 분석하는 중…" />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c45c26" />}
    >
      <ErrorBanner message={error} />

      {complex ? (
        <>
          <Text style={styles.name}>{complex.aptName}</Text>
          <Text style={styles.dong}>{complex.dong}</Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>중위 시세</Text>
              <Text style={styles.statValue}>{formatManwon(complex.medianPrice)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>평당가</Text>
              <Text style={styles.statValue}>{formatPyeongPrice(complex.avgPricePerPyeong)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>변동</Text>
              <Text style={[styles.statValue, { color: changeColor(complex.changePercent) }]}>
                {complex.changePercent === null
                  ? '—'
                  : `${complex.changePercent > 0 ? '+' : ''}${complex.changePercent.toFixed(1)}%`}
              </Text>
            </View>
          </View>

          <Text style={styles.section}>최근 동향</Text>
          <TrendChart monthly={complex.monthly} summary={complex.trendSummary} />

          <Text style={styles.section}>최근 거래</Text>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colDate]}>일자</Text>
              <Text style={[styles.th, styles.colArea]}>면적</Text>
              <Text style={[styles.th, styles.colFloor]}>층</Text>
              <Text style={[styles.th, styles.colPrice]}>가격</Text>
            </View>
            {complex.recentTrades.length === 0 ? (
              <Text style={styles.empty}>거래 내역이 없습니다.</Text>
            ) : (
              complex.recentTrades.map((t, idx) => (
                <View key={`${t.dealDate}-${t.floor}-${idx}`} style={styles.tr}>
                  <Text style={[styles.td, styles.colDate]}>{t.dealDate.slice(5)}</Text>
                  <Text style={[styles.td, styles.colArea]}>{formatArea(t.exclusiveArea)}</Text>
                  <Text style={[styles.td, styles.colFloor]}>{t.floor}</Text>
                  <Text style={[styles.td, styles.colPrice]}>{formatManwon(t.price)}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f1ea',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2332',
  },
  dong: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7580',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e4e9ef',
  },
  statLabel: {
    fontSize: 11,
    color: '#8a949e',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2332',
  },
  section: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2332',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e9ef',
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#efe6db',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e4e9ef',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5c6670',
  },
  td: {
    fontSize: 13,
    color: '#1a2332',
  },
  colDate: { width: '28%' },
  colArea: { width: '28%' },
  colFloor: { width: '16%' },
  colPrice: { width: '28%', textAlign: 'right', fontWeight: '700' },
  empty: {
    padding: 16,
    color: '#6b7580',
    textAlign: 'center',
  },
});
