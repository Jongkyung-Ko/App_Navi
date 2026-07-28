import type { ComplexSummary, NarrationMetric, NarrationSettings } from '../types';
import { narrationMetricLabel, narrationMetricsLabel } from '../services/narrationSettings';

/**
 * Speak prices in compact 억 units.
 * Round to 백만원 (100만), then format like "3.2억" / "1억".
 */
export function formatManwonSpoken(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '정보 없음';
  const millionWon = Math.round(price / 100); // 백만원 단위
  if (millionWon <= 0) return '정보 없음';

  const eok = millionWon / 100; // 억
  if (eok >= 1) {
    const oneDecimal = Math.round(eok * 10) / 10;
    const text = oneDecimal.toFixed(1).replace(/\.0$/, '');
    return `${text}억`;
  }

  // 1억 미만: 천만 단위로 간략히
  if (millionWon >= 10) {
    const cheon = Math.round(millionWon / 10);
    return `${cheon}천만`;
  }
  return `${millionWon * 100}만`;
}

function formatSignedManwonSpoken(price: number): string {
  if (!Number.isFinite(price)) return '정보 없음';
  if (price === 0) return '0';
  if (price < 0) return `${formatManwonSpoken(Math.abs(price))} 역전`;
  return formatManwonSpoken(price);
}

function formatPyeongSpoken(pricePerPyeong: number): string {
  if (!Number.isFinite(pricePerPyeong) || pricePerPyeong <= 0) return '정보 없음';
  return `평당 ${formatManwonSpoken(pricePerPyeong)}`;
}

function exclusiveAreaM2(c: ComplexSummary): number | null {
  if (c.minArea > 0 && c.maxArea > 0) return (c.minArea + c.maxArea) / 2;
  if (c.minArea > 0) return c.minArea;
  if (c.maxArea > 0) return c.maxArea;
  if (c.medianPrice > 0 && c.avgPricePerPyeong > 0) {
    return (c.medianPrice / c.avgPricePerPyeong) * 3.3058;
  }
  return null;
}

function pricePerPyeong(price: number, areaM2: number | null): number | null {
  if (!Number.isFinite(price) || price <= 0 || areaM2 == null || areaM2 <= 0) return null;
  return price / (areaM2 / 3.3058);
}

export function metricValue(c: ComplexSummary, metric: NarrationMetric): number | null {
  const area = exclusiveAreaM2(c);
  switch (metric) {
    case 'sale':
      return Number.isFinite(c.medianPrice) && c.medianPrice > 0 ? c.medianPrice : null;
    case 'jeonse':
      return c.medianJeonse != null && c.medianJeonse > 0 ? c.medianJeonse : null;
    case 'gap':
      return c.saleJeonseGap != null && Number.isFinite(c.saleJeonseGap) ? c.saleJeonseGap : null;
    case 'salePerPyeong':
      return c.avgPricePerPyeong > 0 ? c.avgPricePerPyeong : null;
    case 'jeonsePerPyeong':
      return c.medianJeonse != null ? pricePerPyeong(c.medianJeonse, area) : null;
    case 'gapPerPyeong': {
      if (c.saleJeonseGap != null && Number.isFinite(c.saleJeonseGap)) {
        const gapPy = pricePerPyeong(Math.abs(c.saleJeonseGap), area);
        if (gapPy == null) return null;
        return c.saleJeonseGap < 0 ? -gapPy : gapPy;
      }
      const salePy = c.avgPricePerPyeong > 0 ? c.avgPricePerPyeong : null;
      const jeonsePy = c.medianJeonse != null ? pricePerPyeong(c.medianJeonse, area) : null;
      if (salePy == null || jeonsePy == null) return null;
      return salePy - jeonsePy;
    }
    default:
      return null;
  }
}

function formatMetricSpoken(value: number | null, metric: NarrationMetric): string {
  if (value == null || !Number.isFinite(value)) return '정보 없음';
  switch (metric) {
    case 'sale':
    case 'jeonse':
      return formatManwonSpoken(value);
    case 'gap':
      return formatSignedManwonSpoken(value);
    case 'salePerPyeong':
    case 'jeonsePerPyeong':
      return formatPyeongSpoken(value);
    case 'gapPerPyeong':
      if (value < 0) return `평당 ${formatManwonSpoken(Math.abs(value))} 역전`;
      return formatPyeongSpoken(value);
    default:
      return '정보 없음';
  }
}

function asMetricList(metrics: NarrationMetric | NarrationMetric[]): NarrationMetric[] {
  const list = Array.isArray(metrics) ? metrics : [metrics];
  return list.length > 0 ? list : ['sale'];
}

/** One complex line using the selected narration metric(s). */
export function formatComplexNarration(
  c: ComplexSummary,
  metrics: NarrationMetric | NarrationMetric[] = 'sale',
): string {
  const name = c.aptName.replace(/\s+/g, ' ').trim() || '단지';
  const list = asMetricList(metrics);
  const parts = list.map((metric) => {
    const label = narrationMetricLabel(metric);
    const spoken = formatMetricSpoken(metricValue(c, metric), metric);
    return `${label} ${spoken}`;
  });
  return `${name}는 ${parts.join(', ')}입니다.`;
}

export interface NarrationStats {
  /** Sale-price ranked complexes included in the script (length ≤ topCount). */
  top3: ComplexSummary[];
  avgSale: number | null;
  avgJeonse: number | null;
  script: string;
  metrics: NarrationMetric[];
  topCount: number;
}

const DEFAULT_OPTS: NarrationSettings = { metrics: ['sale'], topCount: 3 };

export function buildNearbyNarration(
  complexes: ComplexSummary[],
  areaLabel?: string,
  opts: NarrationSettings = DEFAULT_OPTS,
): NarrationStats {
  const metrics = asMetricList(opts.metrics ?? ['sale']);
  const topCount = opts.topCount ?? 3;
  const withSale = complexes.filter((c) => Number.isFinite(c.medianPrice) && c.medianPrice > 0);
  // Always rank by 매매가; speak selected metrics for top N.
  const top3 = [...withSale].sort((a, b) => b.medianPrice - a.medianPrice).slice(0, topCount);

  const avgSale =
    withSale.length > 0
      ? withSale.reduce((sum, c) => sum + c.medianPrice, 0) / withSale.length
      : null;

  const withJeonse = complexes.filter(
    (c) => c.medianJeonse !== null && Number.isFinite(c.medianJeonse) && c.medianJeonse > 0,
  );
  const avgJeonse =
    withJeonse.length > 0
      ? withJeonse.reduce((sum, c) => sum + (c.medianJeonse as number), 0) / withJeonse.length
      : null;

  const areaPrefix = areaLabel ? `${areaLabel} 기준, ` : '';
  const metricsLabel = narrationMetricsLabel(metrics);

  if (top3.length === 0) {
    return {
      top3,
      avgSale,
      avgJeonse,
      metrics,
      topCount,
      script: `${areaPrefix}주변에 최근 매매 실거래가 있는 단지를 찾지 못했습니다.`,
    };
  }

  const ranking = top3.map((c) => formatComplexNarration(c, metrics)).join(' ');

  const avgParts = [
    avgSale !== null ? `주변 매매가는 ${formatManwonSpoken(avgSale)}` : null,
    avgJeonse !== null ? `전세는 ${formatManwonSpoken(avgJeonse)}` : null,
  ].filter(Boolean);

  const avgSentence =
    avgParts.length > 0 ? `${avgParts.join('이고, ')}입니다.` : '';

  const script = [
    `${areaPrefix}매매가 상위 ${top3.length}곳의 ${metricsLabel}입니다.`,
    ranking,
    avgSentence,
  ]
    .filter(Boolean)
    .join(' ');

  return { top3, avgSale, avgJeonse, metrics, topCount, script };
}

/** Stable key for Top N identity + spoken metric values (detect ranking changes). */
export function top3Fingerprint(
  top3: ComplexSummary[],
  metrics: NarrationMetric | NarrationMetric[] = 'sale',
): string {
  const list = asMetricList(metrics);
  return top3
    .map((c) => {
      const values = list
        .map((m) => {
          const v = metricValue(c, m);
          return `${m}:${v == null ? 'na' : Math.round(v)}`;
        })
        .join(',');
      return `${c.id}:${values}`;
    })
    .join('|');
}

export function buildTop3ChangedScript(stats: NarrationStats): string {
  if (stats.top3.length === 0) {
    return '위치가 바뀌었지만, 주변에 최근 매매 실거래가 있는 단지를 찾지 못했습니다.';
  }
  const label = narrationMetricsLabel(stats.metrics);
  const ranking = stats.top3.map((c) => formatComplexNarration(c, stats.metrics)).join(' ');
  return `위치가 바뀌어 매매가 Top ${stats.top3.length}의 ${label}가 갱신되었습니다. ${ranking}`;
}

export function buildTop3InvestigateScript(stats: NarrationStats): string {
  if (stats.top3.length === 0) return stats.script;
  const label = narrationMetricsLabel(stats.metrics);
  const ranking = stats.top3.map((c) => formatComplexNarration(c, stats.metrics)).join(' ');
  return `선택한 위치 기준 매매가 상위 ${stats.top3.length}곳의 ${label}입니다. ${ranking}`;
}
