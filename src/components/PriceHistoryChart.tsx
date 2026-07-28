import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import type { ChartTradeDot, QuarterlyPricePoint } from '../types';
import { formatManwonCompact } from '../utils/format';

interface PriceHistoryChartProps {
  quarterly: QuarterlyPricePoint[];
  chartDots?: ChartTradeDot[];
  summary?: string;
}

const CHART_H = 168;
const COL_W = 40;
const DOT = 7;
const TRADE_DOT = 4;

type SeriesKey = 'sale' | 'jeonse' | 'gap';

type SeriesDef = {
  key: SeriesKey;
  medianKey: 'saleMedian' | 'jeonseMedian' | 'gap';
  minKey: 'saleMin' | 'jeonseMin' | 'gapMin';
  maxKey: 'saleMax' | 'jeonseMax' | 'gapMax';
  color: string;
  rangeColor: string;
  tradeColor: string;
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
    tradeColor: 'rgba(196, 92, 38, 0.28)',
    label: '매매',
  },
  {
    key: 'jeonse',
    medianKey: 'jeonseMedian',
    minKey: 'jeonseMin',
    maxKey: 'jeonseMax',
    color: '#2f6fed',
    rangeColor: 'rgba(47, 111, 237, 0.55)',
    tradeColor: 'rgba(47, 111, 237, 0.28)',
    label: '전세',
  },
  {
    key: 'gap',
    medianKey: 'gap',
    minKey: 'gapMin',
    maxKey: 'gapMax',
    color: '#1f6f4a',
    rangeColor: 'rgba(31, 111, 74, 0.55)',
    tradeColor: 'rgba(31, 111, 74, 0.28)',
    label: '갭',
  },
];

type VisibleMap = Record<SeriesKey, boolean>;

const DEFAULT_VISIBLE: VisibleMap = { sale: true, jeonse: true, gap: true };

type ScrubState = {
  index: number;
  x: number;
};

export function PriceHistoryChart({
  quarterly,
  chartDots = [],
  summary,
}: PriceHistoryChartProps) {
  const [visible, setVisible] = useState<VisibleMap>(DEFAULT_VISIBLE);
  const [scrub, setScrub] = useState<ScrubState | null>(null);
  const plotWidthRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const pendingDismiss = useRef(false);
  const scrubRef = useRef<ScrubState | null>(null);
  scrubRef.current = scrub;

  const activeSeries = useMemo(() => SERIES.filter((s) => visible[s.key]), [visible]);

  const max = useMemo(() => {
    const fromLines = quarterly.flatMap((y) =>
      activeSeries.flatMap((s) => [y[s.medianKey], y[s.minKey], y[s.maxKey]]),
    );
    const fromDots = chartDots
      .filter((d) => visible[d.kind])
      .map((d) => d.price);
    const positive = [...fromLines, ...fromDots].filter(
      (v): v is number => v !== null && Number.isFinite(v) && v > 0,
    );
    return Math.max(1, ...positive);
  }, [quarterly, activeSeries, chartDots, visible]);

  const chartWidth = Math.max(quarterly.length * COL_W, COL_W);

  /** Keep the recent end in view (not the oldest 10y start). */
  const scrollToRecent = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });
  };

  useEffect(() => {
    scrollToRecent();
    const t = setTimeout(scrollToRecent, 50);
    return () => clearTimeout(t);
  }, [quarterly.length, chartWidth]);

  const toggleSeries = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.sale && !next.jeonse && !next.gap) return prev;
      return next;
    });
    setScrub(null);
  };

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const indexFromX = (x: number) => {
    if (quarterly.length === 0) return 0;
    const clamped = Math.max(0, Math.min(chartWidth - 1, x));
    return Math.max(0, Math.min(quarterly.length - 1, Math.floor(clamped / COL_W)));
  };

  const applyScrubAt = (x: number) => {
    const idx = indexFromX(x);
    setScrub({ index: idx, x: idx * COL_W + COL_W / 2 });
  };

  const beginHold = (x: number) => {
    clearHoldTimer();
    holding.current = false;
    holdTimer.current = setTimeout(() => {
      holding.current = true;
      pendingDismiss.current = false;
      applyScrubAt(x);
    }, 280);
  };

  const moveHold = (x: number) => {
    if (!holding.current) return;
    pendingDismiss.current = false;
    applyScrubAt(x);
  };

  const endHold = () => {
    clearHoldTimer();
    if (pendingDismiss.current && !holding.current) {
      setScrub(null);
    }
    pendingDismiss.current = false;
    holding.current = false;
  };

  const onGrant = (e: GestureResponderEvent) => {
    pendingDismiss.current = scrubRef.current !== null;
    beginHold(e.nativeEvent.locationX);
  };

  const onMove = (e: GestureResponderEvent) => {
    moveHold(e.nativeEvent.locationX);
  };

  const scrubPoint = scrub ? quarterly[scrub.index] : null;

  const visibleDots = useMemo(
    () => chartDots.filter((d) => visible[d.kind] && d.price > 0 && Number.isFinite(d.price)),
    [chartDots, visible],
  );

  if (quarterly.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.empty}>분기별 시세 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      <View style={styles.toggles}>
        {SERIES.map((s) => {
          const on = visible[s.key];
          return (
            <Pressable
              key={s.key}
              onPress={() => toggleSeries(s.key)}
              style={[styles.toggle, on && { backgroundColor: s.color, borderColor: s.color }]}
            >
              <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.legendHint}>
        분기 중위가 라인 · 옅은 점 = 실거래 · 길게 누르면 분기 가격(손 떼도 유지) · 짧게 다시
        누르면 닫힘
      </Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={scrollToRecent}
      >
        <View style={{ width: chartWidth }}>
          <View
            style={[styles.plot, { height: CHART_H, width: chartWidth }]}
            onLayout={(e: LayoutChangeEvent) => {
              plotWidthRef.current = e.nativeEvent.layout.width;
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onGrant}
            onResponderMove={onMove}
            onResponderRelease={endHold}
            onResponderTerminate={endHold}
          >
            {/* Trade scatter under lines */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {visibleDots.map((d, idx) => {
                const series = SERIES.find((s) => s.key === d.kind);
                if (!series) return null;
                const left = d.x * COL_W - TRADE_DOT / 2;
                const top = valueToY(d.price, max) - TRADE_DOT / 2;
                return (
                  <View
                    key={`t-${d.kind}-${idx}`}
                    style={[
                      styles.tradeDot,
                      {
                        left,
                        top,
                        backgroundColor: series.tradeColor,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {activeSeries.map((series) => (
              <React.Fragment key={series.key}>
                <LineSeries
                  color={series.rangeColor}
                  values={quarterly.map((y) => y[series.maxKey])}
                  max={max}
                  dashed
                  showDots={false}
                />
                <LineSeries
                  color={series.rangeColor}
                  values={quarterly.map((y) => y[series.minKey])}
                  max={max}
                  dashed
                  showDots={false}
                />
                <LineSeries
                  color={series.color}
                  values={quarterly.map((y) => y[series.medianKey])}
                  max={max}
                />
              </React.Fragment>
            ))}

            {scrub && scrubPoint ? (
              <>
                <View style={[styles.scrubLine, { left: scrub.x - 0.75 }]} />
                <View
                  style={[
                    styles.scrubCard,
                    {
                      left: Math.min(Math.max(8, scrub.x - 70), chartWidth - 148),
                    },
                  ]}
                >
                  <Text style={styles.scrubYear}>{scrubPoint.label}</Text>
                  {activeSeries.map((s) => {
                    const median = scrubPoint[s.medianKey];
                    const min = scrubPoint[s.minKey];
                    const maxV = scrubPoint[s.maxKey];
                    return (
                      <View key={s.key} style={styles.scrubRow}>
                        <View style={[styles.scrubDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.scrubLabel, { color: s.color }]}>{s.label}</Text>
                        <Text style={styles.scrubValue}>
                          {median !== null ? formatManwonCompact(median) : '—'}
                          {min !== null && maxV !== null
                            ? ` (${formatManwonCompact(min)}~${formatManwonCompact(maxV)})`
                            : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.axisRow}>
            {quarterly.map((q, idx) => (
              <View key={q.key} style={styles.axisCol}>
                <Text style={[styles.year, scrub?.index === idx && styles.yearActive]}>
                  {q.quarter === 1 ? String(q.year).slice(2) : `${q.quarter}Q`}
                </Text>
                {visible.sale ? (
                  <Text style={styles.tip}>
                    {q.saleMedian !== null ? formatManwonCompact(q.saleMedian) : '-'}
                  </Text>
                ) : null}
                {visible.jeonse ? (
                  <Text style={[styles.tip, styles.tipJeonse]}>
                    {q.jeonseMedian !== null ? formatManwonCompact(q.jeonseMedian) : '-'}
                  </Text>
                ) : null}
                {visible.gap ? (
                  <Text style={[styles.tip, styles.tipGap]}>
                    {q.gap !== null ? formatManwonCompact(q.gap) : '-'}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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

  // Connect across empty quarters (skip nulls, join neighboring valid points)
  const valid = points.filter((p): p is { x: number; y: number; value: number } => p !== null);
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < valid.length - 1; i++) {
    const a = valid[i]!;
    const b = valid[i + 1]!;
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
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
  toggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c4b0',
    backgroundColor: '#fff',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5c6670',
  },
  toggleTextOn: {
    color: '#fff',
  },
  legendHint: {
    fontSize: 11,
    color: '#8a939c',
    marginBottom: 10,
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
    borderWidth: 2,
    zIndex: 2,
  },
  tradeDot: {
    position: 'absolute',
    width: TRADE_DOT,
    height: TRADE_DOT,
    borderRadius: TRADE_DOT / 2,
    zIndex: 1,
  },
  scrubLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(26, 35, 50, 0.45)',
    zIndex: 4,
  },
  scrubCard: {
    position: 'absolute',
    top: 8,
    width: 140,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: '#d7dee7',
    zIndex: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  scrubYear: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a2332',
    marginBottom: 4,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  scrubDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  scrubLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 28,
  },
  scrubValue: {
    flex: 1,
    fontSize: 11,
    color: '#1a2332',
    fontWeight: '600',
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
    fontSize: 10,
    fontWeight: '800',
    color: '#1a2332',
  },
  yearActive: {
    color: '#c45c26',
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
