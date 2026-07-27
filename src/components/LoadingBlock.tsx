import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingBlockProps {
  label?: string;
}

export function LoadingBlock({ label = '불러오는 중…' }: LoadingBlockProps) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color="#c45c26" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#6b7580',
    fontSize: 13,
  },
});
