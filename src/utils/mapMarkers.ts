import type { ComplexSummary } from '../types';
import { formatManwonCompact } from './format';

export interface MarkerPoint {
  lat: number;
  lng: number;
  title?: string;
  /** Pixel radius for circle marker */
  radius: number;
  fillColor: string;
  strokeColor: string;
  priceLabel?: string;
  tradeCount?: number;
  tier?: 'high' | 'mid' | 'low';
}

const TIER = {
  high: { fill: 'rgba(220, 38, 38, 0.55)', stroke: 'rgba(185, 28, 28, 0.9)' },
  mid: { fill: 'rgba(234, 88, 12, 0.55)', stroke: 'rgba(194, 65, 12, 0.9)' },
  low: { fill: 'rgba(234, 179, 8, 0.55)', stroke: 'rgba(202, 138, 4, 0.9)' },
} as const;

const RADIUS_MIN = 10;
const RADIUS_MAX = 22;
const TOP_N = 10;

function priceTertileThresholds(sortedAsc: number[]): { lowMax: number; midMax: number } {
  const n = sortedAsc.length;
  if (n === 0) return { lowMax: 0, midMax: 0 };
  if (n === 1) return { lowMax: sortedAsc[0], midMax: sortedAsc[0] };
  const lowIdx = Math.floor((n - 1) / 3);
  const midIdx = Math.floor((2 * (n - 1)) / 3);
  return { lowMax: sortedAsc[lowIdx], midMax: sortedAsc[midIdx] };
}

function tierAmongTop10(price: number, lowMax: number, midMax: number): keyof typeof TIER {
  if (price > midMax) return 'high';
  if (price > lowMax) return 'mid';
  return 'low';
}

function radiusForCount(count: number, minC: number, maxC: number): number {
  if (!Number.isFinite(count) || maxC <= minC) return Math.round((RADIUS_MIN + RADIUS_MAX) / 2);
  const t = (count - minC) / (maxC - minC);
  return Math.round(RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN));
}

/**
 * Style map spots:
 * - Rank by sale price, take Top 10 → split into high/mid/low (red/orange/yellow)
 * - Everything outside Top 10 → low (yellow)
 * - Circle size scales with trade volume among visible markers
 */
export function buildStyledMapMarkers(
  complexes: ComplexSummary[],
  limit = 20,
): MarkerPoint[] {
  const withCoords = complexes
    .filter((c) => c.lat != null && c.lng != null && Number.isFinite(c.medianPrice))
    .slice(0, limit);

  if (withCoords.length === 0) return [];

  const byPriceDesc = [...withCoords].sort((a, b) => b.medianPrice - a.medianPrice);
  const top10 = byPriceDesc.slice(0, TOP_N);
  const top10Ids = new Set(top10.map((c) => c.id));
  const top10PricesAsc = top10.map((c) => c.medianPrice).sort((a, b) => a - b);
  const { lowMax, midMax } = priceTertileThresholds(top10PricesAsc);

  const counts = withCoords.map((c) => c.tradeCount || 0);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);

  return withCoords.map((c) => {
    const tierName = top10Ids.has(c.id)
      ? tierAmongTop10(c.medianPrice, lowMax, midMax)
      : 'low';
    const colors = TIER[tierName];
    const tradeCount = c.tradeCount || 0;
    const avg = c.avgPrice > 0 ? c.avgPrice : c.medianPrice;
    const priceLabel = formatManwonCompact(avg);
    return {
      lat: c.lat!,
      lng: c.lng!,
      title: `${c.aptName} · ${priceLabel} · 거래 ${tradeCount}건`,
      priceLabel,
      tradeCount,
      tier: tierName,
      radius: radiusForCount(tradeCount, minC, maxC),
      fillColor: colors.fill,
      strokeColor: colors.stroke,
    };
  });
}

/** Sort complexes by median sale price, highest first. */
export function sortBySalePriceDesc(items: ComplexSummary[]): ComplexSummary[] {
  return [...items].sort((a, b) => (b.medianPrice || 0) - (a.medianPrice || 0));
}
