import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ErrorBannerProps {
  message: string | null;
  tone?: 'error' | 'info';
}

export function ErrorBanner({ message, tone = 'error' }: ErrorBannerProps) {
  if (!message) return null;
  const isInfo = tone === 'info';
  return (
    <View style={[styles.banner, isInfo && styles.infoBanner]}>
      <Text style={[styles.text, isInfo && styles.infoText]}>{message}</Text>
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
  infoBanner: {
    backgroundColor: '#eef3f8',
    borderColor: '#c9d6e5',
  },
  text: {
    color: '#8a1f1f',
    fontSize: 13,
    lineHeight: 18,
  },
  infoText: {
    color: '#1a2332',
  },
});
