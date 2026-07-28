import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRadiusLabel } from '../services/nearbySettings';
import type { NearbySearchScope } from '../types';

type Props = {
  scope: NearbySearchScope;
  radiusKm: number;
  onChange: (scope: NearbySearchScope) => void;
  onPressRadiusSettings?: () => void;
};

export function SearchScopeChips({
  scope,
  radiusKm,
  onChange,
  onPressRadiusSettings,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>조사 범위</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: scope === 'sigungu' }}
          onPress={() => onChange('sigungu')}
          style={[styles.chip, scope === 'sigungu' && styles.chipOn]}
        >
          <Text style={[styles.chipText, scope === 'sigungu' && styles.chipTextOn]}>
            행정구역
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: scope === 'radius' }}
          onPress={() => onChange('radius')}
          style={[styles.chip, scope === 'radius' && styles.chipOn]}
        >
          <Text style={[styles.chipText, scope === 'radius' && styles.chipTextOn]}>
            반경 {formatRadiusLabel(radiusKm)}
          </Text>
        </Pressable>
        {onPressRadiusSettings ? (
          <Pressable
            accessibilityLabel="반경 설정"
            onPress={onPressRadiusSettings}
            style={styles.settingsBtn}
          >
            <Text style={styles.settingsText}>설정</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>
        {scope === 'radius'
          ? `현재 위치 기준 ${formatRadiusLabel(radiusKm)} 안 단지를 찾습니다`
          : '시군구(구·시·군) 전체 단지를 찾습니다'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4d5c5',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2332',
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  settingsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  settingsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c45c26',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7580',
  },
});
