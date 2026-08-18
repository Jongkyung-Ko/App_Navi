import React, { createElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/** Material-style expand / fullscreen paths (24x24). */
const FULLSCREEN_PATH =
  'M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4z';

/**
 * Centered fullscreen / expand icon for map controls.
 * Web renders a real DOM <svg>; native uses solid corner bars.
 */
export function MapFullscreenIcon({ size = 18, color = '#fff' }: Props) {
  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: color,
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': true,
        focusable: 'false',
        style: {
          display: 'block',
          flexShrink: 0,
        },
      },
      createElement('path', { d: FULLSCREEN_PATH }),
    );
  }

  const inset = Math.max(1, Math.round(size * 0.05));
  const arm = Math.max(5, Math.round(size * 0.4));
  const thick = Math.max(2, Math.round(size * 0.15));

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.barH, { width: arm, height: thick, backgroundColor: color, top: inset, left: inset }]} />
      <View style={[styles.barV, { width: thick, height: arm, backgroundColor: color, top: inset, left: inset }]} />

      <View style={[styles.barH, { width: arm, height: thick, backgroundColor: color, top: inset, right: inset }]} />
      <View style={[styles.barV, { width: thick, height: arm, backgroundColor: color, top: inset, right: inset }]} />

      <View style={[styles.barH, { width: arm, height: thick, backgroundColor: color, bottom: inset, left: inset }]} />
      <View style={[styles.barV, { width: thick, height: arm, backgroundColor: color, bottom: inset, left: inset }]} />

      <View style={[styles.barH, { width: arm, height: thick, backgroundColor: color, bottom: inset, right: inset }]} />
      <View style={[styles.barV, { width: thick, height: arm, backgroundColor: color, bottom: inset, right: inset }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'relative',
  },
  barH: {
    position: 'absolute',
    borderRadius: 1,
  },
  barV: {
    position: 'absolute',
    borderRadius: 1,
  },
});
