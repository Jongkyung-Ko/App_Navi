import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Switch, Text, View } from 'react-native';
import { narrationSettingsHint } from '../services/narrationSettings';
import type { ComplexSummary, NarrationSettings } from '../types';
import {
  formatManwonSpoken,
  top3Fingerprint,
  type NarrationStats,
} from '../utils/narration';

export type TextCardTone = 'upHot' | 'up' | 'down' | 'flat';

export type FullscreenTextCardModel = {
  id: string;
  rank: number;
  name: string;
  changeText: string;
  arrow: string;
  changeColor: string;
  saleText: string;
  jeonseText: string;
  gapText: string;
  callout: string | null;
  changePercent: number | null;
  tone: TextCardTone;
};

const HOLD_MS = 10000;
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

function changeColorFor(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.05) return '#e5e7eb';
  return pct > 0 ? '#fecaca' : '#bfdbfe';
}

function arrowFor(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.05) return '';
  return pct > 0 ? '▲' : '▼';
}

function changeTextFor(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  if (Math.abs(pct) < 0.05) return '0%';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function calloutForPyeongChange(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct) || pct < 5) return null;
  if (pct >= 10) return `최근 매매평단가 10% 이상 급등 · 많이 올랐습니다`;
  return `최근 매매평단가 5% 이상 상승 · 많이 올랐습니다`;
}

export function buildFullscreenTextCards(
  narration: NarrationStats,
): FullscreenTextCardModel[] {
  return narration.top3.map((c, i) => {
    const changePercent = recentPyeongChange(c);
    return {
      id: c.id,
      rank: i + 1,
      name: c.aptName,
      changeText: changeTextFor(changePercent),
      arrow: arrowFor(changePercent),
      changeColor: changeColorFor(changePercent),
      saleText: c.medianPrice > 0 ? formatManwonSpoken(c.medianPrice) : '-',
      jeonseText:
        c.medianJeonse != null && c.medianJeonse > 0
          ? formatManwonSpoken(c.medianJeonse)
          : '-',
      gapText:
        c.saleJeonseGap != null && Number.isFinite(c.saleJeonseGap)
          ? c.saleJeonseGap < 0
            ? `${formatManwonSpoken(Math.abs(c.saleJeonseGap))} 역전`
            : formatManwonSpoken(c.saleJeonseGap)
          : '-',
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
};

export function FullscreenTextCardOverlay({ enabled, narration }: OverlayProps) {
  const cards = useMemo(() => buildFullscreenTextCards(narration), [narration]);
  const fingerprint = useMemo(
    () => top3Fingerprint(narration.top3, narration.metrics),
    [narration.top3, narration.metrics],
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_Y)).current;
  const cancelled = useRef(false);
  const shownFingerprint = useRef<string | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    cancelled.current = false;
    if (!enabled || cards.length === 0) {
      setVisible(false);
      opacity.setValue(0);
      translateY.setValue(ENTER_Y);
      return;
    }

    // Already shown for this Top ranking — do not show again.
    if (shownFingerprint.current === fingerprint) {
      setVisible(false);
      opacity.setValue(0);
      translateY.setValue(ENTER_Y);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let anim: Animated.CompositeAnimation | null = null;
    setVisible(true);

    const finishPlaythrough = () => {
      shownFingerprint.current = fingerprint;
      setVisible(false);
      opacity.setValue(0);
      translateY.setValue(ENTER_Y);
    };

    const runOnce = (startIndex: number) => {
      if (cancelled.current) return;
      const list = cardsRef.current;
      if (list.length === 0) {
        finishPlaythrough();
        return;
      }
      if (startIndex >= list.length) {
        finishPlaythrough();
        return;
      }

      setIndex(startIndex);
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
            runOnce(startIndex + 1);
          });
        }, HOLD_MS);
      });
    };

    runOnce(0);

    return () => {
      cancelled.current = true;
      if (timeout) clearTimeout(timeout);
      anim?.stop();
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [enabled, fingerprint, cards.length, opacity, translateY]);

  if (!enabled || !visible) return null;
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
        <Text style={styles.topRank}>Top{card.rank}</Text>

        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {card.name}
          </Text>
          <Text style={[styles.change, { color: card.changeColor }]}>
            {card.changeText}
            {card.arrow ? ` ${card.arrow}` : ''}
          </Text>
        </View>

        <View style={styles.metrics}>
          <Text style={styles.metricLine}>매매가: {card.saleText}</Text>
          <Text style={styles.metricLine}>전세가: {card.jeonseText}</Text>
          <Text style={styles.metricLine}>갭: {card.gapText}</Text>
        </View>

        {card.callout ? <Text style={styles.callout}>{card.callout}</Text> : null}

        <Text style={styles.footer}>
          {index + 1}/{cards.length} · Top {narration.topCount}
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
  },
  card: {
    height: '80%',
    maxHeight: '80%',
    alignSelf: 'stretch',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 24,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  toneUpHot: {
    backgroundColor: 'rgba(153, 27, 27, 0.62)',
  },
  toneUp: {
    backgroundColor: 'rgba(185, 28, 28, 0.58)',
  },
  toneDown: {
    backgroundColor: 'rgba(30, 64, 175, 0.58)',
  },
  toneFlat: {
    backgroundColor: 'rgba(26, 35, 50, 0.55)',
  },
  topRank: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 28,
  },
  name: {
    flex: 1,
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  change: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
  metrics: {
    gap: 14,
  },
  metricLine: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  callout: {
    marginTop: 24,
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
