import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { LoadingBlock } from '../../src/components/LoadingBlock';
import { PriceHistoryChart } from '../../src/components/PriceHistoryChart';
import { fetchComplexDetail } from '../../src/services/api';
import type { AreaBand, ComplexSummary } from '../../src/types';
import { changeColor, formatArea, formatManwon, formatPyeongPrice } from '../../src/utils/format';

export default function ComplexDetailScreen() {
  const params = useLocalSearchParams<{
    lawdCd?: string;
    aptName?: string;
    dong?: string;
    areaTarget?: string;
  }>();

  const initialArea = params.areaTarget ? Number(params.areaTarget) : undefined;
  const [areaTarget, setAreaTarget] = useState<number | undefined>(
    Number.isFinite(initialArea) ? initialArea : undefined,
  );

  useEffect(() => {
    const next = params.areaTarget ? Number(params.areaTarget) : undefined;
    setAreaTarget(Number.isFinite(next as number) ? next : undefined);
  }, [params.areaTarget]);

  const [complex, setComplex] = useState<ComplexSummary | null>(null);
  const [areaBands, setAreaBands] = useState<AreaBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [chartYears, setChartYears] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    if (!params.lawdCd || !params.aptName) {
      setError('단지 정보가 없습니다.');
      setLoading(false);
      return;
    }
    const gen = ++loadGen.current;
    setLoading(true);
    setExtending(false);
    setChartYears(3);
    setError(null);
    try {
      // Progressive: show recent 3y first, then fill out to 10y
      const quick = await fetchComplexDetail({
        lawdCd: params.lawdCd,
        aptName: params.aptName,
        dong: params.dong,
        years: 3,
        areaTarget,
      });
      if (gen !== loadGen.current) return;
      setComplex(quick.complex);
      setAreaBands(quick.areaBands ?? []);
      setLoading(false);

      setExtending(true);
      try {
        const full = await fetchComplexDetail({
          lawdCd: params.lawdCd,
          aptName: params.aptName,
          dong: params.dong,
          years: 10,
          areaTarget,
        });
        if (gen !== loadGen.current) return;
        setComplex(full.complex);
        setAreaBands(full.areaBands ?? []);
        setChartYears(10);
      } catch (err) {
        if (gen !== loadGen.current) return;
        // Keep 3y chart if extension fails
        setError(err instanceof Error ? err.message : '10년 시세 조회 실패');
      } finally {
        if (gen === loadGen.current) setExtending(false);
      }
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : '상세 조회 실패');
      setLoading(false);
    }
  }, [params.lawdCd, params.aptName, params.dong, areaTarget]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !complex) {
    return <LoadingBlock label="최근 시세를 집계하는 중…" />;
  }

  const selectedLabel =
    areaTarget !== undefined
      ? areaBands.find((b) => b.targetM2 === areaTarget)?.label ?? `${areaTarget}㎡`
      : '전체 면적';

  const chartSummary = complex
    ? [
        `${selectedLabel}`,
        complex.medianPrice ? `매매 ${formatManwon(complex.medianPrice)}` : null,
        complex.medianJeonse !== null ? `전세 ${formatManwon(complex.medianJeonse)}` : null,
        complex.saleJeonseGap !== null ? `차이 ${formatManwon(complex.saleJeonseGap)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

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

          <Text style={styles.section}>면적(평형)</Text>
          <Text style={styles.sectionHint}>주요 전용면적 기준으로 시세 차트를 나눠 봅니다.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <AreaChip
              label="전체"
              active={areaTarget === undefined}
              onPress={() => setAreaTarget(undefined)}
            />
            {areaBands.map((band) => (
              <AreaChip
                key={band.targetM2}
                label={`${band.label}`}
                meta={`매매 ${band.saleCount} · 전세 ${band.jeonseCount}`}
                active={areaTarget === band.targetM2}
                onPress={() => setAreaTarget(band.targetM2)}
              />
            ))}
          </ScrollView>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>매매 중위</Text>
              <Text style={[styles.statValue, { color: '#c45c26' }]}>
                {complex.medianPrice ? formatManwon(complex.medianPrice) : '—'}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>전세 중위</Text>
              <Text style={[styles.statValue, { color: '#2f6fed' }]}>
                {complex.medianJeonse !== null ? formatManwon(complex.medianJeonse) : '—'}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>매매-전세</Text>
              <Text style={[styles.statValue, { color: '#1f6f4a' }]}>
                {complex.saleJeonseGap !== null ? formatManwon(complex.saleJeonseGap) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>평당 매매</Text>
              <Text style={styles.statValue}>{formatPyeongPrice(complex.avgPricePerPyeong)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>매매 변동</Text>
              <Text style={[styles.statValue, { color: changeColor(complex.changePercent) }]}>
                {complex.changePercent === null
                  ? '—'
                  : `${complex.changePercent > 0 ? '+' : ''}${complex.changePercent.toFixed(1)}%`}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>선택 면적</Text>
              <Text style={styles.statValue} numberOfLines={2}>
                {selectedLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.section}>최근 {chartYears}년 시세</Text>
          <Text style={styles.sectionHint}>
            {selectedLabel} · 분기 단위 · 옅은 점=실거래 · 길게 누르면 분기 가격
            {extending ? ' · 10년 데이터 불러오는 중…' : ''}
          </Text>
          {loading ? <LoadingBlock label="면적별 시세 다시 집계 중…" /> : null}
          {extending ? <LoadingBlock label="과거 10년 매매·전세 시세를 이어서 집계 중…" /> : null}
          <PriceHistoryChart
            quarterly={complex.quarterly ?? []}
            chartDots={complex.chartDots ?? []}
            summary={chartSummary}
          />

          <Text style={styles.section}>최근 매매</Text>
          <TradeTable rows={complex.recentTrades} empty="매매 내역이 없습니다." />

          <Text style={styles.section}>최근 전세</Text>
          <TradeTable
            rows={complex.recentJeonseTrades ?? []}
            empty="전세 내역이 없습니다."
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function AreaChip({
  label,
  meta,
  active,
  onPress,
}: {
  label: string;
  meta?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {meta ? (
        <Text style={[styles.chipMeta, active && styles.chipMetaActive]}>{meta}</Text>
      ) : null}
    </Pressable>
  );
}

function TradeTable({
  rows,
  empty,
}: {
  rows: ComplexSummary['recentTrades'];
  empty: string;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colDate]}>일자</Text>
        <Text style={[styles.th, styles.colArea]}>면적</Text>
        <Text style={[styles.th, styles.colFloor]}>층</Text>
        <Text style={[styles.th, styles.colPrice]}>가격</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        rows.map((t, idx) => (
          <View key={`${t.dealDate}-${t.floor}-${idx}`} style={styles.tr}>
            <Text style={[styles.td, styles.colDate]}>{t.dealDate.slice(5)}</Text>
            <Text style={[styles.td, styles.colArea]}>{formatArea(t.exclusiveArea)}</Text>
            <Text style={[styles.td, styles.colFloor]}>{t.floor}</Text>
            <Text style={[styles.td, styles.colPrice]}>{formatManwon(t.price)}</Text>
          </View>
        ))
      )}
    </View>
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
  chips: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7c4b0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 88,
  },
  chipActive: {
    backgroundColor: '#1a2332',
    borderColor: '#1a2332',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a2332',
  },
  chipLabelActive: {
    color: '#fff',
  },
  chipMeta: {
    marginTop: 3,
    fontSize: 10,
    color: '#6b7580',
  },
  chipMetaActive: {
    color: '#c9d2dc',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
    fontSize: 13,
    fontWeight: '800',
    color: '#1a2332',
  },
  section: {
    marginTop: 22,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2332',
  },
  sectionHint: {
    marginBottom: 10,
    fontSize: 12,
    color: '#6b7580',
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
