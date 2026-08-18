import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Classic expand / fullscreen corners, centered in the map control. */
export function MapFullscreenIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  const arm = Math.max(4, Math.round(size * 0.38));
  const thick = Math.max(2, Math.round(size * 0.14));

  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden>
      <View
        style={[
          styles.corner,
          styles.topLeft,
          { width: arm, height: arm, borderColor: color, borderTopWidth: thick, borderLeftWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.topRight,
          { width: arm, height: arm, borderColor: color, borderTopWidth: thick, borderRightWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.bottomLeft,
          { width: arm, height: arm, borderColor: color, borderBottomWidth: thick, borderLeftWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.bottomRight,
          { width: arm, height: arm, borderColor: color, borderBottomWidth: thick, borderRightWidth: thick },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
});
