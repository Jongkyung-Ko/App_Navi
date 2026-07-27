import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MonthlyTrend } from '../types';
import { formatManwon } from '../utils/format';

interface TrendChartProps {
  monthly: MonthlyTrend[];
  summary?: string;
}

export function TrendChart({ monthly, summary }: TrendChartProps) {
  const max = useMemo(
    () => Math.max(1, ...monthly.map((m) => m.medianPrice || 0)),
    [monthly],
  );

  if (monthly.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.empty}>월별 시세 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      <View style={styles.chart}>
        {monthly.map((m) => {
          const h = Math.max(8, Math.round((m.medianPrice / max) * 120));
          return (
            <View key={m.month} style={styles.col}>
              <Text style={styles.value}>{m.tradeCount ? formatManwon(m.medianPrice) : '-'}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: m.tradeCount ? h : 8, opacity: m.tradeCount ? 1 : 0.25 }]} />
              </View>
              <Text style={styles.month}>{m.month.slice(2)}</Text>
              <Text style={styles.count}>{m.tradeCount}건</Text>
            </View>
          );
        })}
      </View>
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
    marginBottom: 14,
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 180,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 9,
    color: '#6b7580',
    marginBottom: 6,
    textAlign: 'center',
  },
  barTrack: {
    height: 120,
    justifyContent: 'flex-end',
    width: '70%',
  },
  bar: {
    width: '100%',
    backgroundColor: '#c45c26',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  month: {
    marginTop: 6,
    fontSize: 11,
    color: '#1a2332',
    fontWeight: '600',
  },
  count: {
    fontSize: 10,
    color: '#8a949e',
  },
  empty: {
    color: '#6b7580',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
