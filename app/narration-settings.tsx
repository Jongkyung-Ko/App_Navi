import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNarrationSettings } from '../src/hooks/useNarrationSettings';
import {
  narrationMetricLabel,
  narrationMetricsLabel,
  normalizeMetrics,
} from '../src/services/narrationSettings';
import {
  NARRATION_METRIC_OPTIONS,
  NARRATION_TOP_COUNT_OPTIONS,
  type NarrationMetric,
  type NarrationTopCount,
} from '../src/types';

export default function NarrationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, ready, update } = useNarrationSettings();

  const toggleMetric = (metric: NarrationMetric) => {
    const current = normalizeMetrics(settings.metrics);
    const on = current.includes(metric);
    if (on) {
      if (current.length <= 1) return;
      void update({ metrics: current.filter((m) => m !== metric) });
      return;
    }
    void update({
      metrics: normalizeMetrics([...current, metric]),
    });
  };

  const setTopCount = (topCount: NarrationTopCount) => {
    void update({ topCount });
  };

  const selectedLabel = narrationMetricsLabel(settings.metrics);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Stack.Screen options={{ title: '나레이션 설정' }} />

      <Text style={styles.sectionTitle}>읽어줄 항목</Text>
      <Text style={styles.sectionSub}>
        매매가 순위 단지 목록을 기준으로, 선택한 항목을 소리로 안내합니다. 2개 이상 복수 선택할 수
        있습니다.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>안내 항목</Text>
        <Text style={styles.cardValue}>{selectedLabel}</Text>
        <View style={styles.row}>
          {NARRATION_METRIC_OPTIONS.map((metric) => {
            const on = settings.metrics.includes(metric);
            return (
              <Pressable
                key={metric}
                onPress={() => toggleMetric(metric)}
                style={[styles.chip, on && styles.chipOn]}
                disabled={!ready}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {narrationMetricLabel(metric)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.cardHint}>항목을 눌러 켜고 끌 수 있습니다. 최소 1개는 선택해야 합니다.</Text>
      </View>

      <Text style={[styles.sectionTitle, styles.sectionSpaced]}>읽어줄 순위</Text>
      <Text style={styles.sectionSub}>
        매매가 높은 순 Top 1부터 선택한 순위까지만 나레이션합니다.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>상위 단지 수</Text>
        <Text style={styles.cardValue}>Top {settings.topCount}</Text>
        <View style={styles.row}>
          {NARRATION_TOP_COUNT_OPTIONS.map((n) => {
            const on = settings.topCount === n;
            return (
              <Pressable
                key={n}
                onPress={() => setTopCount(n)}
                style={[styles.chip, on && styles.chipOn]}
                disabled={!ready}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>Top {n}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.cardHint}>
          예: Top 2를 고르면 매매가 1위·2위 단지의 {selectedLabel}를 읽습니다.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f1ea',
  },
  sectionTitle: {
    marginTop: 20,
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2332',
  },
  sectionSpaced: {
    marginTop: 28,
  },
  sectionSub: {
    marginTop: 6,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7580',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4d5c5',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8a6a4b',
  },
  cardValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2332',
  },
  row: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f1ebe3',
    borderWidth: 1,
    borderColor: '#e0d3c4',
  },
  chipOn: {
    backgroundColor: '#1a2332',
    borderColor: '#1a2332',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5c6670',
  },
  chipTextOn: {
    color: '#fff',
  },
  cardHint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#6b7580',
  },
});
