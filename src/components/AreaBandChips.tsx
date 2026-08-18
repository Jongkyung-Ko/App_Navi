import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AREA_BAND_PRESETS } from '../utils/areaBands';

type Props = {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  title?: string;
  hint?: string;
  /** When set, only show 전체 + these targets (plus keep current selection). */
  availableTargets?: number[];
  /** Drop outer horizontal padding when nested in an already-padded layout. */
  embedded?: boolean;
  /**
   * Map overlay: collapsed trigger shows the current area (default 84㎡).
   * Tap to expand and pick; selection collapses back to the chosen label.
   */
  overlay?: boolean;
};

export function AreaBandChips({
  value,
  onChange,
  title = '주요 면적(평형)',
  hint = '선택하면 매매·전세 시세와 10년 차트가 해당 면적만 보여줍니다.',
  availableTargets,
  embedded = false,
  overlay = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const presets = useMemo(
    () =>
      availableTargets && availableTargets.length > 0
        ? AREA_BAND_PRESETS.filter(
            (p) => p.value === undefined || availableTargets.includes(p.value) || p.value === value,
          )
        : AREA_BAND_PRESETS,
    [availableTargets, value],
  );

  const selected = useMemo(
    () => presets.find((p) => p.value === value) ?? AREA_BAND_PRESETS[0],
    [presets, value],
  );

  useEffect(() => {
    // Close the picker when the selected area changes from outside.
    setOpen(false);
  }, [value]);

  if (overlay) {
    return (
      <View style={styles.overlayRoot} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`면적 ${selected.shortLabel}${open ? ' 선택 닫기' : ' 선택 열기'}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          style={[styles.trigger, open && styles.triggerOpen]}
        >
          <Text style={styles.triggerText}>{selected.shortLabel}</Text>
          <Text style={styles.triggerCaret}>{open ? '▴' : '▾'}</Text>
        </Pressable>

        {open ? (
          <View style={styles.pickerPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {presets.map((preset) => {
                const active = value === preset.value;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      onChange(preset.value);
                      setOpen(false);
                    }}
                    style={[styles.chip, styles.chipOverlay, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        styles.chipTextOverlay,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {preset.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {presets.map((preset) => {
          const active = value === preset.value;
          return (
            <Pressable
              key={preset.label}
              onPress={() => onChange(preset.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {preset.shortLabel}
              </Text>
              {preset.value !== undefined ? (
                <Text style={[styles.chipSub, active && styles.chipSubActive]}>
                  약 {Math.round((preset.value / 3.3058) * 1.3)}평
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  wrapEmbedded: {
    marginTop: 8,
    paddingHorizontal: 0,
  },
  overlayRoot: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 35, 50, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  triggerOpen: {
    backgroundColor: 'rgba(26, 35, 50, 0.58)',
  },
  triggerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  triggerCaret: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  pickerPanel: {
    marginTop: 6,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2332',
  },
  hint: {
    marginTop: 3,
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7580',
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4d5c5',
    minWidth: 64,
    alignItems: 'center',
  },
  chipOverlay: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  chipActive: {
    backgroundColor: 'rgba(26, 35, 50, 0.72)',
    borderColor: 'rgba(26, 35, 50, 0.72)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a2332',
  },
  chipTextOverlay: {
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  chipSub: {
    marginTop: 2,
    fontSize: 10,
    color: '#8a939c',
  },
  chipSubActive: {
    color: '#d7c4b0',
  },
});
