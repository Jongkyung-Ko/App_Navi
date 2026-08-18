import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * Fullscreen / expand icon: four outward corner brackets.
 * Built from Views so layout stays centered on RN Web (raw <svg> was not).
 */
export function MapFullscreenIcon({ size = 18, color = '#fff' }: Props) {
  const thick = Math.max(2, Math.round(size * 0.14));
  const arm = Math.max(5, Math.round(size * 0.36));
  const gap = Math.max(2, Math.round(size * 0.14));

  // Inner drawing box, centered by parent flex.
  const box = size;

  return (
    <View style={[styles.root, { width: box, height: box }]} pointerEvents="none">
      {/* top-left */}
      <View style={[styles.h, { backgroundColor: color, width: arm, height: thick, top: gap, left: gap }]} />
      <View style={[styles.v, { backgroundColor: color, width: thick, height: arm, top: gap, left: gap }]} />
      {/* top-right */}
      <View style={[styles.h, { backgroundColor: color, width: arm, height: thick, top: gap, right: gap }]} />
      <View style={[styles.v, { backgroundColor: color, width: thick, height: arm, top: gap, right: gap }]} />
      {/* bottom-left */}
      <View style={[styles.h, { backgroundColor: color, width: arm, height: thick, bottom: gap, left: gap }]} />
      <View style={[styles.v, { backgroundColor: color, width: thick, height: arm, bottom: gap, left: gap }]} />
      {/* bottom-right */}
      <View style={[styles.h, { backgroundColor: color, width: arm, height: thick, bottom: gap, right: gap }]} />
      <View style={[styles.v, { backgroundColor: color, width: thick, height: arm, bottom: gap, right: gap }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  h: {
    position: 'absolute',
    borderRadius: 1,
  },
  v: {
    position: 'absolute',
    borderRadius: 1,
  },
});
