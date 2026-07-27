import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ErrorBannerProps {
  message: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  text: {
    color: '#8a1f1f',
    fontSize: 13,
    lineHeight: 18,
  },
});
