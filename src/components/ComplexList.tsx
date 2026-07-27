import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComplexSummary } from '../types';
import { changeColor, formatManwon, formatPyeongPrice } from '../utils/format';

interface ComplexListProps {
  items: ComplexSummary[];
  onPress: (item: ComplexSummary) => void;
  emptyMessage?: string;
}

export function ComplexList({ items, onPress, emptyMessage }: ComplexListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage ?? '표시할 단지가 없습니다.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable key={item.id} style={styles.row} onPress={() => onPress(item)}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.aptName}
            </Text>
            <Text style={[styles.change, { color: changeColor(item.changePercent) }]}>
              {item.changePercent === null
                ? '—'
                : `${item.changePercent > 0 ? '+' : ''}${item.changePercent.toFixed(1)}%`}
            </Text>
          </View>
          <Text style={styles.dong}>{item.dong}</Text>
          <View style={styles.rowBottom}>
            <View>
              <Text style={styles.price}>{formatManwon(item.medianPrice)}</Text>
              {item.medianJeonse !== null ? (
                <Text style={styles.jeonse}>
                  전세 {formatManwon(item.medianJeonse)}
                  {item.saleJeonseGap !== null ? ` · 차 ${formatManwon(item.saleJeonseGap)}` : ''}
                </Text>
              ) : null}
            </View>
            <Text style={styles.meta}>
              {formatPyeongPrice(item.avgPricePerPyeong)} · 매매 {item.tradeCount}건
              {item.jeonseCount ? ` · 전세 ${item.jeonseCount}건` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e4e9ef',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2332',
  },
  change: {
    fontSize: 13,
    fontWeight: '700',
  },
  dong: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7580',
  },
  rowBottom: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: '#c45c26',
  },
  jeonse: {
    marginTop: 3,
    fontSize: 12,
    color: '#2f6fed',
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    color: '#6b7580',
    maxWidth: '42%',
    textAlign: 'right',
  },
  empty: {
    padding: 28,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7580',
    fontSize: 14,
  },
});
