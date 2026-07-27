import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  enabled: boolean;
  speaking: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function NarrationToggle({ enabled, speaking, disabled, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <Text style={styles.title}>시세 나레이션</Text>
        <Text style={styles.hint}>
          {enabled
            ? speaking
              ? '매매가 Top 3와 평균을 읽어주는 중…'
              : 'On · 상위 3곳과 매매·전세 평균을 안내합니다'
            : 'Off · 켜면 주변 고가 단지를 소리로 알려줍니다'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled, disabled: !!disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={[styles.track, enabled && styles.trackOn, disabled && styles.trackDisabled]}
      >
        <View style={[styles.thumb, enabled && styles.thumbOn]} />
        <Text style={[styles.label, enabled ? styles.labelOn : styles.labelOff]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4d5c5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2332',
  },
  hint: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7580',
  },
  track: {
    width: 72,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d9dde3',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  trackOn: {
    backgroundColor: '#c45c26',
  },
  trackDisabled: {
    opacity: 0.45,
  },
  thumb: {
    position: 'absolute',
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  thumbOn: {
    left: undefined,
    right: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  labelOn: {
    color: '#fff',
    marginLeft: 8,
  },
  labelOff: {
    color: '#5c6670',
    textAlign: 'right',
    marginRight: 8,
  },
});
