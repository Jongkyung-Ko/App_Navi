import React, { useCallback } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { GAPGAPGAP_LABEL, GAPGAPGAP_URL } from '../constants/apps';

type Props = {
  compact?: boolean;
  fullWidth?: boolean;
};

async function openGapGapGap() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(GAPGAPGAP_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    const supported = await Linking.canOpenURL(GAPGAPGAP_URL);
    if (!supported) {
      Alert.alert('열 수 없음', '갭갭갭 링크를 열 수 없습니다.');
      return;
    }
    await Linking.openURL(GAPGAPGAP_URL);
  } catch {
    Alert.alert('열 수 없음', '갭갭갭 링크를 열 수 없습니다.');
  }
}

export function GapGapGapLinkButton({ compact = false, fullWidth = false }: Props) {
  const onPress = useCallback(() => {
    void openGapGapGap();
  }, []);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="갭갭갭 열기"
      onPress={onPress}
      style={[
        compact ? styles.compactBtn : styles.homeBtn,
        fullWidth && styles.fullWidth,
      ]}
    >
      <Text style={compact ? styles.compactBtnText : styles.homeBtnText}>
        {compact ? GAPGAPGAP_LABEL : `${GAPGAPGAP_LABEL} 열기`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactBtn: {
    backgroundColor: '#c45c26',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c45c26',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compactBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  homeBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c45c26',
    paddingVertical: 13,
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#c45c26',
    fontWeight: '800',
    fontSize: 14,
  },
  fullWidth: {
    marginHorizontal: 0,
    flex: 1,
  },
});
