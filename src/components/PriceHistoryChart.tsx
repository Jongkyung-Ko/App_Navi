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

type SeriesDef = {
  key: 'sale' | 'jeonse' | 'gap';
  medianKey: 'saleMedian' | 'jeonseMedian' | 'gap';
  minKey: 'saleMin' | 'jeonseMin' | 'gapMin';
  maxKey: 'saleMax' | 'jeonseMax' | 'gapMax';
  color: string;
  rangeColor: string;
  label: string;
};

const SERIES: SeriesDef[] = [
  {
    key: 'sale',
    medianKey: 'saleMedian',
    minKey: 'saleMin',
    maxKey: 'saleMax',
    color: '#c45c26',
    rangeColor: 'rgba(196, 92, 38, 0.55)',
    label: '매매',
  },
  {
    key: 'jeonse',
    medianKey: 'jeonseMedian',
    minKey: 'jeonseMin',
    maxKey: 'jeonseMax',
    color: '#2f6fed',
    rangeColor: 'rgba(47, 111, 237, 0.55)',
    label: '전세',
  },
  {
    key: 'gap',
    medianKey: 'gap',
    minKey: 'gapMin',
    maxKey: 'gapMax',
    color: '#1f6f4a',
    rangeColor: 'rgba(31, 111, 74, 0.55)',
    label: '매매-전세',
  },
];

export function PriceHistoryChart({ yearly, summary }: PriceHistoryChartProps) {
  const max = useMemo(() => {
    const vals = yearly.flatMap((y) =>
      [
        y.saleMedian,
        y.saleMin,
        y.saleMax,
        y.jeonseMedian,
        y.jeonseMin,
        y.jeonseMax,
        y.gap,
        y.gapMin,
        y.gapMax,
      ].filter((v): v is number => v !== null && Number.isFinite(v) && v > 0),
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
          <LegendItem key={s.key} color={s.color} rangeColor={s.rangeColor} label={s.label} />
        ))}
      </View>
      <Text style={styles.legendHint}>실선·점 = 중위 · 점선 = 같은 색 계열 min / max</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth }}>
          <View style={[styles.plot, { height: CHART_H, width: chartWidth }]}>
            {SERIES.map((series) => (
              <React.Fragment key={series.key}>
                <LineSeries
                  color={series.rangeColor}
                  values={yearly.map((y) => y[series.maxKey])}
                  max={max}
                  dashed
                  showDots={false}
                />
                <LineSeries
                  color={series.rangeColor}
                  values={yearly.map((y) => y[series.minKey])}
                  max={max}
                  dashed
                  showDots={false}
                />
                <LineSeries
                  color={series.color}
                  values={yearly.map((y) => y[series.medianKey])}
                  max={max}
                />
              </React.Fragment>
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

function LegendItem({
  color,
  rangeColor,
  label,
}: {
  color: string;
  rangeColor: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { backgroundColor: color }]} />
      <View style={[styles.legendDot, { backgroundColor: '#fff', borderColor: color }]} />
      <View style={styles.legendDashRow}>
        <View style={[styles.legendDash, { backgroundColor: rangeColor }]} />
        <View style={[styles.legendDash, { backgroundColor: rangeColor }]} />
      </View>
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LineSeries({
  color,
  values,
  max,
  dashed = false,
  showDots = true,
}: {
  color: string;
  values: Array<number | null>;
  max: number;
  dashed?: boolean;
  showDots?: boolean;
}) {
  const points = values.map((value, index) => {
    if (value === null || !Number.isFinite(value) || value <= 0) return null;
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
      {segments.map((seg, idx) =>
        dashed ? (
          <DashedLineSegment key={`dash-${idx}`} {...seg} color={color} />
        ) : (
          <LineSegment key={`seg-${idx}`} {...seg} color={color} />
        ),
      )}
      {showDots
        ? points.map((p, idx) =>
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
          )
        : null}
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

/** Draw a dashed stroke between two points using short segments. */
function DashedLineSegment({
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
  if (length < 1) return null;

  const ux = dx / length;
  const uy = dy / length;
  const dash = 5;
  const gap = 4;
  const step = dash + gap;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const parts: Array<{ cx: number; cy: number; w: number }> = [];

  for (let d = 0; d < length; d += step) {
    const w = Math.min(dash, length - d);
    if (w < 1.5) break;
    const mx = x1 + ux * (d + w / 2);
    const my = y1 + uy * (d + w / 2);
    parts.push({ cx: mx, cy: my, w });
  }

  return (
    <>
      {parts.map((p, idx) => (
        <View
          key={`d-${idx}`}
          style={{
            position: 'absolute',
            left: p.cx - p.w / 2,
            top: p.cy - 0.9,
            width: p.w,
            height: 1.8,
            backgroundColor: color,
            borderRadius: 1,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      ))}
    </>
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
    marginBottom: 4,
  },
  legendHint: {
    fontSize: 11,
    color: '#8a939c',
    marginBottom: 10,
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
  },
  legendDashRow: {
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: 1,
  },
  legendDash: {
    width: 4,
    height: 2,
    borderRadius: 1,
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
