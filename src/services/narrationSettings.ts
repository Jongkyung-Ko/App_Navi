import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NARRATION_METRIC_OPTIONS,
  NARRATION_TOP_COUNT_OPTIONS,
  type NarrationMetric,
  type NarrationSettings,
  type NarrationTopCount,
} from '../types';

const STORAGE_KEY = 'appnavi.narrationSettings.v1';

export const DEFAULT_NARRATION_SETTINGS: NarrationSettings = {
  metric: 'sale',
  topCount: 3,
};

const METRIC_LABELS: Record<NarrationMetric, string> = {
  sale: '매매가',
  jeonse: '전세가',
  gap: '갭',
  salePerPyeong: '평당 매매가',
  jeonsePerPyeong: '평당 전세가',
  gapPerPyeong: '평당 갭',
};

function normalizeMetric(value: unknown): NarrationMetric {
  if (typeof value === 'string' && (NARRATION_METRIC_OPTIONS as readonly string[]).includes(value)) {
    return value as NarrationMetric;
  }
  return DEFAULT_NARRATION_SETTINGS.metric;
}

function normalizeTopCount(value: unknown): NarrationTopCount {
  const n = Number(value);
  if ((NARRATION_TOP_COUNT_OPTIONS as readonly number[]).includes(n)) {
    return n as NarrationTopCount;
  }
  return DEFAULT_NARRATION_SETTINGS.topCount;
}

function normalizeSettings(raw: unknown): NarrationSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NARRATION_SETTINGS };
  const obj = raw as Partial<NarrationSettings>;
  return {
    metric: normalizeMetric(obj.metric),
    topCount: normalizeTopCount(obj.topCount),
  };
}

export async function loadNarrationSettings(): Promise<NarrationSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NARRATION_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_NARRATION_SETTINGS };
  }
}

export async function saveNarrationSettings(
  next: NarrationSettings,
): Promise<NarrationSettings> {
  const normalized = normalizeSettings(next);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function narrationMetricLabel(metric: NarrationMetric): string {
  return METRIC_LABELS[metric];
}

export function narrationSettingsHint(settings: NarrationSettings): string {
  return `${narrationMetricLabel(settings.metric)} · Top ${settings.topCount}`;
}
