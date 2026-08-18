import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * Fullscreen icon: four corner brackets.
 * Only top/left absolute offsets — right/bottom positioning is unreliable on RN Web.
 */
export function MapFullscreenIcon({ size = 18, color = '#fff' }: Props) {
  const thick = 2;
  const arm = Math.max(5, Math.round(size * 0.34));
  const pad = Math.max(2, Math.round((size - (arm * 2 + thick)) / 2));

  const left = pad;
  const right = size - pad - arm;
  const rightV = size - pad - thick;
  const top = pad;
  const bottom = size - pad - arm;
  const bottomH = size - pad - thick;

  const bar = (style: object) => (
    <View style={[styles.bar, { backgroundColor: color }, style]} />
  );

  return (
    <View style={[styles.root, { width: size, height: size }]} pointerEvents="none">
      {/* top-left */}
      {bar({ width: arm, height: thick, top, left })}
      {bar({ width: thick, height: arm, top, left })}
      {/* top-right */}
      {bar({ width: arm, height: thick, top, left: right })}
      {bar({ width: thick, height: arm, top, left: rightV })}
      {/* bottom-left */}
      {bar({ width: arm, height: thick, top: bottomH, left })}
      {bar({ width: thick, height: arm, top: bottom, left })}
      {/* bottom-right */}
      {bar({ width: arm, height: thick, top: bottomH, left: right })}
      {bar({ width: thick, height: arm, top: bottom, left: rightV })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    borderRadius: 0.5,
  },
});
