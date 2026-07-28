import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeatureToggle } from './FeatureToggle';

type Props = {
  enabled: boolean;
  speaking: boolean;
  disabled?: boolean;
  hint?: string;
  onToggle: () => void;
  onPressSettings?: () => void;
};

export function NarrationToggle({
  enabled,
  speaking,
  disabled,
  hint,
  onToggle,
  onPressSettings,
}: Props) {
  const resolvedHint =
    hint ??
    (enabled
      ? speaking
        ? '선택 항목을 읽어주는 중…'
        : 'On · 설정한 항목과 순위까지 안내합니다'
      : 'Off · 켜면 주변 고가 단지를 소리로 알려줍니다');

  return (
    <View>
      <FeatureToggle
        title="시세 나레이션"
        enabled={enabled}
        hint={resolvedHint}
        disabled={disabled}
        onToggle={onToggle}
      />
      {onPressSettings ? (
        <Pressable
          accessibilityLabel="나레이션 설정"
          onPress={onPressSettings}
          style={styles.settingsRow}
        >
          <Text style={styles.settingsLabel}>나레이션 설정</Text>
          <Text style={styles.settingsAction}>설정</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    marginHorizontal: 16,
    marginTop: -2,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#e8d5c2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5c6670',
  },
  settingsAction: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c45c26',
  },
});
