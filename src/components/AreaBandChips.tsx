import React from 'react';
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
};

export function AreaBandChips({
  value,
  onChange,
  title = '주요 면적(평형)',
  hint = '선택하면 매매·전세 시세와 10년 차트가 해당 면적만 보여줍니다.',
  availableTargets,
  embedded = false,
}: Props) {
  const presets =
    availableTargets && availableTargets.length > 0
      ? AREA_BAND_PRESETS.filter(
          (p) => p.value === undefined || availableTargets.includes(p.value) || p.value === value,
        )
      : AREA_BAND_PRESETS;

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
    gap: 8,
    paddingRight: 8,
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
  chipActive: {
    backgroundColor: '#1a2332',
    borderColor: '#1a2332',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a2332',
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
