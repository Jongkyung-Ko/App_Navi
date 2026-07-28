import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Switch, Text, View } from 'react-native';
import { narrationMetricsLabel, narrationSettingsHint } from '../services/narrationSettings';
import type { ComplexSummary, NarrationSettings } from '../types';
import { formatComplexNarration, type NarrationStats } from '../utils/narration';

export type TextCardTone = 'upHot' | 'up' | 'down' | 'flat';

export type FullscreenTextCardModel = {
  id: string;
  rank: number;
  title: string;
  body: string;
  callout: string;
  changePercent: number | null;
  tone: TextCardTone;
};

const HOLD_MS = 3000;
const FADE_MS = 420;
const ENTER_Y = 56;
const EXIT_Y = -56;

function recentPyeongChange(c: ComplexSummary): number | null {
  if (c.salePerPyeongChangePercent != null && Number.isFinite(c.salePerPyeongChangePercent)) {
    return c.salePerPyeongChangePercent;
  }
  if (c.changePercent != null && Number.isFinite(c.changePercent)) return c.changePercent;
  return null;
}

export function toneForPyeongChange(pct: number | null): TextCardTone {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.05) return 'flat';
  if (pct >= 10) return 'upHot';
  if (pct > 0) return 'up';
  return 'down';
}

export function calloutForPyeongChange(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '최근 매매평단가 변동 정보 없음';
  if (Math.abs(pct) < 0.05) return '최근 매매평단가 보합';
  if (pct >= 10) {
    return `최근 매매평단가 10% 이상 급등 · +${pct.toFixed(1)}% · 많이 올랐습니다`;
  }
  if (pct >= 5) {
    return `최근 매매평단가 5% 이상 상승 · +${pct.toFixed(1)}% · 많이 올랐습니다`;
  }
  if (pct > 0) return `최근 매매평단가 상승 · +${pct.toFixed(1)}%`;
  return `최근 매매평단가 하락 · ${pct.toFixed(1)}%`;
}

export function buildFullscreenTextCards(
  narration: NarrationStats,
  areaLabel?: string,
): FullscreenTextCardModel[] {
  const metricsLabel = narrationMetricsLabel(narration.metrics);
  const area = areaLabel ? `${areaLabel} · ` : '';
  return narration.top3.map((c, i) => {
    const changePercent = recentPyeongChange(c);
    return {
      id: c.id,
      rank: i + 1,
      title: `${i + 1}위 · ${c.aptName}`,
      body: [
        `${area}매매가 Top ${narration.topCount} · ${metricsLabel}`,
        formatComplexNarration(c, narration.metrics),
      ].join('\n'),
      callout: calloutForPyeongChange(changePercent),
      changePercent,
      tone: toneForPyeongChange(changePercent),
    };
  });
}

type ToggleProps = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  settings: NarrationSettings;
  canEnable: boolean;
};

export function FullscreenTextCardToggle({
  enabled,
  onToggle,
  settings,
  canEnable,
}: ToggleProps) {
  return (
    <View style={styles.toggleInline}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>텍스트 카드</Text>
        <Text style={styles.toggleHint} numberOfLines={1}>
          {narrationSettingsHint(settings)}
        </Text>
      </View>
      <Switch
        accessibilityLabel="텍스트 카드 표시"
        value={enabled && canEnable}
        disabled={!canEnable}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#c45c26' }}
        thumbColor="#fff"
        ios_backgroundColor="rgba(255,255,255,0.25)"
      />
    </View>
  );
}

type OverlayProps = {
  enabled: boolean;
  narration: NarrationStats;
  areaLabel?: string;
};

export function FullscreenTextCardOverlay({ enabled, narration, areaLabel }: OverlayProps) {
  const cards = useMemo(
    () => buildFullscreenTextCards(narration, areaLabel),
    [narration, areaLabel],
  );
  const cardKey = cards.map((c) => c.id).join('|');
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_Y)).current;
  const cancelled = useRef(false);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    setIndex(0);
  }, [cardKey]);

  useEffect(() => {
    cancelled.current = false;
    if (!enabled || cards.length === 0) {
      opacity.setValue(0);
      translateY.setValue(ENTER_Y);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let anim: Animated.CompositeAnimation | null = null;

    const runCycle = (startIndex: number) => {
      if (cancelled.current) return;
      const list = cardsRef.current;
      if (list.length === 0) return;
      const i = ((startIndex % list.length) + list.length) % list.length;
      setIndex(i);

      opacity.setValue(0);
      translateY.setValue(ENTER_Y);

      anim = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      anim.start(({ finished }) => {
        if (!finished || cancelled.current) return;
        timeout = setTimeout(() => {
          if (cancelled.current) return;
          anim = Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0,
              duration: FADE_MS,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: EXIT_Y,
              duration: FADE_MS,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]);
          anim.start(({ finished: outDone }) => {
            if (!outDone || cancelled.current) return;
            runCycle(i + 1);
          });
        }, HOLD_MS);
      });
    };

    runCycle(0);

    return () => {
      cancelled.current = true;
      if (timeout) clearTimeout(timeout);
      anim?.stop();
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [enabled, cards.length, cardKey, opacity, translateY]);

  if (!enabled) return null;
  const card = cards[index];
  if (!card) return null;

  return (
    <View style={styles.stage} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          toneStyle(card.tone),
          { opacity, transform: [{ translateY }] },
        ]}
      >
        <Text style={styles.rank}>{card.title}</Text>
        <Text style={styles.body}>{card.body}</Text>
        <Text style={styles.callout}>{card.callout}</Text>
        <Text style={styles.footer}>
          {index + 1}/{cards.length} · 나레이션 설정 기준
        </Text>
      </Animated.View>
    </View>
  );
}

function toneStyle(tone: TextCardTone) {
  switch (tone) {
    case 'upHot':
      return styles.toneUpHot;
    case 'up':
      return styles.toneUp;
    case 'down':
      return styles.toneDown;
    default:
      return styles.toneFlat;
  }
}

const styles = StyleSheet.create({
  toggleInline: {
    flex: 1,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  toggleHint: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 72,
  },
  card: {
    flex: 1,
    maxHeight: '100%',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 28,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  toneUpHot: {
    backgroundColor: 'rgba(153, 27, 27, 0.92)',
  },
  toneUp: {
    backgroundColor: 'rgba(185, 28, 28, 0.88)',
  },
  toneDown: {
    backgroundColor: 'rgba(30, 64, 175, 0.88)',
  },
  toneFlat: {
    backgroundColor: 'rgba(26, 35, 50, 0.9)',
  },
  rank: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 16,
  },
  body: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 34,
  },
  callout: {
    marginTop: 22,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
  },
  footer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 22,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
});
