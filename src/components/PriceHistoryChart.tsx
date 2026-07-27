import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { YearlyPricePoint } from '../types';
import { formatManwon } from '../utils/format';

interface PriceHistoryChartProps {
  yearly: YearlyPricePoint[];
  summary?: string;
}

export function PriceHistoryChart({ yearly, summary }: PriceHistoryChartProps) {
  const max = useMemo(() => {
    const vals = yearly.flatMap((y) =>
      [y.saleMedian, y.jeonseMedian, y.gap].filter((v): v is number => v !== null && v > 0),
    );
    return Math.max(1, ...vals);
  }, [yearly]);

  if (yearly.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.empty}>연도별 시세 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      <View style={styles.legend}>
        <LegendDot color="#c45c26" label="매매" />
        <LegendDot color="#2f6fed" label="전세" />
        <LegendDot color="#1f6f4a" label="매매-전세" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
        {yearly.map((y) => (
          <View key={y.year} style={styles.col}>
            <View style={styles.bars}>
              <Bar color="#c45c26" value={y.saleMedian} max={max} />
              <Bar color="#2f6fed" value={y.jeonseMedian} max={max} />
              <Bar color="#1f6f4a" value={y.gap} max={max} />
            </View>
            <Text style={styles.year}>{String(y.year).slice(2)}</Text>
            <Text style={styles.tip}>
              {y.saleMedian !== null ? formatManwon(y.saleMedian) : '-'}
            </Text>
            <Text style={[styles.tip, styles.tipJeonse]}>
              {y.jeonseMedian !== null ? formatManwon(y.jeonseMedian) : '-'}
            </Text>
            <Text style={[styles.tip, styles.tipGap]}>
              {y.gap !== null ? formatManwon(y.gap) : '-'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Bar({
  color,
  value,
  max,
}: {
  color: string;
  value: number | null;
  max: number;
}) {
  const h = value && value > 0 ? Math.max(6, Math.round((value / max) * 110)) : 4;
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.bar,
          {
            height: h,
            backgroundColor: color,
            opacity: value && value > 0 ? 1 : 0.2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e4e9ef',
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1a2332',
    marginBottom: 12,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#5c6670',
    fontWeight: '600',
  },
  chartRow: {
    alignItems: 'flex-end',
    gap: 10,
    paddingRight: 8,
    minHeight: 200,
  },
  col: {
    width: 52,
    alignItems: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  barTrack: {
    width: 12,
    height: 120,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  year: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#1a2332',
  },
  tip: {
    marginTop: 2,
    fontSize: 8,
    color: '#c45c26',
    textAlign: 'center',
  },
  tipJeonse: { color: '#2f6fed' },
  tipGap: { color: '#1f6f4a' },
  empty: {
    color: '#6b7580',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
