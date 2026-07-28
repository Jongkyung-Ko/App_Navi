import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearbySettings } from '../src/hooks/useNearbySettings';
import { formatRadiusLabel } from '../src/services/nearbySettings';
import { RADIUS_KM_OPTIONS, type NearbySearchScope } from '../src/types';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, ready, update } = useNearbySettings();

  const setScope = (scope: NearbySearchScope) => {
    void update({ scope });
  };

  const setRadius = (radiusKm: number) => {
    void update({ scope: 'radius', radiusKm });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Stack.Screen options={{ title: '설정' }} />

      <Text style={styles.sectionTitle}>주변 단지 조사 범위</Text>
      <Text style={styles.sectionSub}>
        행정구역(시군구) 또는 내 위치 반경으로 단지를 찾을 수 있습니다. 반경은 아래에서
        바꿀 수 있습니다.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>범위 방식</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setScope('sigungu')}
            style={[styles.chip, settings.scope === 'sigungu' && styles.chipOn]}
            disabled={!ready}
          >
            <Text style={[styles.chipText, settings.scope === 'sigungu' && styles.chipTextOn]}>
              행정구역
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('radius')}
            style={[styles.chip, settings.scope === 'radius' && styles.chipOn]}
            disabled={!ready}
          >
            <Text style={[styles.chipText, settings.scope === 'radius' && styles.chipTextOn]}>
              내 위치 반경
            </Text>
          </Pressable>
        </View>
        <Text style={styles.cardHint}>
          {settings.scope === 'radius'
            ? '현재 시군구 실거래 중, 좌표가 확인된 단지에서 반경 안만 표시합니다.'
            : '선택한 위치의 시군구(구·시·군) 전체 단지를 표시합니다.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>반경</Text>
        <Text style={styles.cardValue}>현재 {formatRadiusLabel(settings.radiusKm)}</Text>
        <View style={styles.row}>
          {RADIUS_KM_OPTIONS.map((km) => {
            const on = settings.radiusKm === km;
            return (
              <Pressable
                key={km}
                onPress={() => setRadius(km)}
                style={[styles.chip, on && styles.chipOn]}
                disabled={!ready}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {formatRadiusLabel(km)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.cardHint}>
          반경을 고르면 조사 범위가 자동으로 「내 위치 반경」으로 바뀝니다.
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
