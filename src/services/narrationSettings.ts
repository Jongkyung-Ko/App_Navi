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
  metrics: ['sale'],
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

function isMetric(value: unknown): value is NarrationMetric {
  return typeof value === 'string' && (NARRATION_METRIC_OPTIONS as readonly string[]).includes(value);
}

/** Keep canonical option order and drop duplicates / invalids. */
export function normalizeMetrics(value: unknown, fallbackMetric?: unknown): NarrationMetric[] {
  const fromArray = Array.isArray(value) ? value.filter(isMetric) : [];
  const selected = new Set<NarrationMetric>(fromArray);
  if (selected.size === 0 && isMetric(fallbackMetric)) {
    selected.add(fallbackMetric);
  }
  const ordered = NARRATION_METRIC_OPTIONS.filter((m) => selected.has(m));
  return ordered.length > 0 ? ordered : [...DEFAULT_NARRATION_SETTINGS.metrics];
}

function normalizeTopCount(value: unknown): NarrationTopCount {
  const n = Number(value);
  if ((NARRATION_TOP_COUNT_OPTIONS as readonly number[]).includes(n)) {
    return n as NarrationTopCount;
  }
  return DEFAULT_NARRATION_SETTINGS.topCount;
}

function normalizeSettings(raw: unknown): NarrationSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NARRATION_SETTINGS, metrics: [...DEFAULT_NARRATION_SETTINGS.metrics] };
  const obj = raw as Partial<NarrationSettings> & { metric?: unknown };
  return {
    metrics: normalizeMetrics(obj.metrics, obj.metric),
    topCount: normalizeTopCount(obj.topCount),
  };
}

export async function loadNarrationSettings(): Promise<NarrationSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NARRATION_SETTINGS, metrics: [...DEFAULT_NARRATION_SETTINGS.metrics] };
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_NARRATION_SETTINGS, metrics: [...DEFAULT_NARRATION_SETTINGS.metrics] };
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

export function narrationMetricsLabel(metrics: NarrationMetric[]): string {
  const list = normalizeMetrics(metrics);
  return list.map(narrationMetricLabel).join('·');
}

export function narrationSettingsHint(settings: NarrationSettings): string {
  return `${narrationMetricsLabel(settings.metrics)} · Top ${settings.topCount}`;
}
