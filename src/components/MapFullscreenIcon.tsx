import React, { useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

function fullscreenSvg(color: string): string {
  // Classic expand corners, 24x24 viewBox, stroke centered.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">` +
    `<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" ` +
    `stroke="${color}" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"/>` +
    `</svg>`
  );
}

/**
 * Fullscreen / expand icon — four corner brackets, centered in the control.
 * Web uses an SVG data-URI for crisp pixels; native uses solid bars.
 */
export function MapFullscreenIcon({ size = 18, color = '#fff' }: Props) {
  const uri = useMemo(() => {
    const svg = fullscreenSvg(color);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [color]);

  if (Platform.OS === 'web') {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
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
