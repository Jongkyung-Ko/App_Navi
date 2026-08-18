import React, { createElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * Outward corner arrows — the usual “expand / fullscreen” affordance.
 * Drawn larger and wrapped so RN Web flex-centering actually applies.
 */
const EXPAND_PATH =
  'M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm16 0h2v7h-7v-2h5v-5z';

export function MapFullscreenIcon({ size = 20, color = '#fff' }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
        {createElement(
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
              width: size,
              height: size,
            },
          },
          createElement('path', { d: EXPAND_PATH }),
        )}
      </View>
    );
  }

  const inset = 1;
  const arm = Math.max(6, Math.round(size * 0.38));
  const thick = Math.max(2, Math.round(size * 0.16));

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
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
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
