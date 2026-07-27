import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ReverseGeocodeResult } from '../types';

interface AddressCardProps {
  address: ReverseGeocodeResult | null;
  loading?: boolean;
}

export function AddressCard({ address, loading }: AddressCardProps) {
  if (loading && !address) {
    return (
      <View style={styles.card}>
        <View style={[styles.skel, { width: '55%' }]} />
        <View style={[styles.skel, { width: '80%', marginTop: 10 }]} />
        <View style={[styles.skel, { width: '40%', marginTop: 10 }]} />
      </View>
    );
  }

  if (!address) return null;

  const primary = address.roadAddress ?? address.jibunAddress ?? '주소 없음';
  const region = [address.region1, address.region2, address.region3].filter(Boolean).join(' ');

  return (
    <View style={styles.card}>
      <Text style={styles.label}>현재 위치</Text>
      <Text style={styles.address}>{primary}</Text>
      <Text style={styles.meta}>{region}</Text>
      <Text style={styles.meta}>
        법정동코드 {address.lawdCd}
        {address.mock ? ' · 데모 데이터' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: -28,
    padding: 16,
    backgroundColor: '#fffaf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7d5c3',
    shadowColor: '#1a2332',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#8a6a4b',
    fontWeight: '600',
    marginBottom: 6,
  },
  address: {
    fontSize: 17,
    lineHeight: 24,
    color: '#1a2332',
    fontWeight: '700',
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: '#5c6670',
  },
  skel: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#efe6db',
  },
});
