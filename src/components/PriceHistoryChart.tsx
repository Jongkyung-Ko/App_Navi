import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { YearlyPricePoint } from '../types';
import { formatManwon } from '../utils/format';

interface PriceHistoryChartProps {
  yearly: YearlyPricePoint[];
  summary?: string;
}

const CHART_H = 150;
const COL_W = 56;
const DOT = 8;

const SERIES = [
  { key: 'saleMedian' as const, color: '#c45c26', label: '매매' },
  { key: 'jeonseMedian' as const, color: '#2f6fed', label: '전세' },
  { key: 'gap' as const, color: '#1f6f4a', label: '매매-전세' },
];

export function PriceHistoryChart({ yearly, summary }: PriceHistoryChartProps) {
  const max = useMemo(() => {
    const vals = yearly.flatMap((y) =>
      [y.saleMedian, y.jeonseMedian, y.gap].filter((v): v is number => v !== null && v > 0),
    );
    return Math.max(1, ...vals);
  }, [yearly]);

  const chartWidth = Math.max(yearly.length * COL_W, COL_W);

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
        {SERIES.map((s) => (
          <LegendItem key={s.key} color={s.color} label={s.label} />
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth }}>
          <View style={[styles.plot, { height: CHART_H, width: chartWidth }]}>
            {SERIES.map((series) => (
              <LineSeries
                key={series.key}
                color={series.color}
                values={yearly.map((y) => y[series.key])}
                max={max}
              />
            ))}
          </View>

          <View style={styles.axisRow}>
            {yearly.map((y) => (
              <View key={y.year} style={styles.axisCol}>
                <Text style={styles.year}>{String(y.year).slice(2)}</Text>
                <Text style={styles.tip}>{y.saleMedian !== null ? formatManwon(y.saleMedian) : '-'}</Text>
                <Text style={[styles.tip, styles.tipJeonse]}>
                  {y.jeonseMedian !== null ? formatManwon(y.jeonseMedian) : '-'}
                </Text>
                <Text style={[styles.tip, styles.tipGap]}>
                  {y.gap !== null ? formatManwon(y.gap) : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { backgroundColor: color }]} />
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LineSeries({
  color,
  values,
  max,
}: {
  color: string;
  values: Array<number | null>;
  max: number;
}) {
  const points = values.map((value, index) => {
    if (value === null || value <= 0) return null;
    const x = index * COL_W + COL_W / 2;
    const y = valueToY(value, max);
    return { x, y, value };
  });

  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {segments.map((seg, idx) => (
        <LineSegment key={`seg-${idx}`} {...seg} color={color} />
      ))}
      {points.map((p, idx) =>
        p ? (
          <View
            key={`dot-${idx}`}
            style={[
              styles.point,
              {
                left: p.x - DOT / 2,
                top: p.y - DOT / 2,
                backgroundColor: '#fff',
                borderColor: color,
              },
            ]}
          />
        ) : null,
      )}
    </View>
  );
}

function LineSegment({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - 1.25,
        width: length,
        height: 2.5,
        backgroundColor: color,
        borderRadius: 2,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function valueToY(value: number, max: number): number {
  const usable = CHART_H - 20;
  return CHART_H - 10 - (value / max) * usable;
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
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#5c6670',
    fontWeight: '600',
  },
  plot: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d7dee7',
    backgroundColor: '#fbfcfe',
    overflow: 'hidden',
  },
  point: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2.5,
  },
  axisRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  axisCol: {
    width: COL_W,
    alignItems: 'center',
  },
  year: {
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
