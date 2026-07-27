import type { ComplexSummary } from '../types';
import { formatManwon } from './format';

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
}

const TIER = {
  high: { fill: 'rgba(220, 38, 38, 0.55)', stroke: 'rgba(185, 28, 28, 0.9)' },
  mid: { fill: 'rgba(234, 88, 12, 0.55)', stroke: 'rgba(194, 65, 12, 0.9)' },
  low: { fill: 'rgba(234, 179, 8, 0.55)', stroke: 'rgba(202, 138, 4, 0.9)' },
} as const;

const RADIUS_MIN = 7;
const RADIUS_MAX = 20;

function priceTier(sortedAsc: number[]): { lowMax: number; midMax: number } {
  const n = sortedAsc.length;
  if (n === 0) return { lowMax: 0, midMax: 0 };
  if (n === 1) return { lowMax: sortedAsc[0], midMax: sortedAsc[0] };
  const lowIdx = Math.floor((n - 1) / 3);
  const midIdx = Math.floor((2 * (n - 1)) / 3);
  return { lowMax: sortedAsc[lowIdx], midMax: sortedAsc[midIdx] };
}

function tierForPrice(price: number, lowMax: number, midMax: number) {
  if (price > midMax) return TIER.high;
  if (price > lowMax) return TIER.mid;
  return TIER.low;
}

function radiusForCount(count: number, minC: number, maxC: number): number {
  if (!Number.isFinite(count) || maxC <= minC) return Math.round((RADIUS_MIN + RADIUS_MAX) / 2);
  const t = (count - minC) / (maxC - minC);
  return Math.round(RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN));
}

/** Style nearby complexes: red/orange/yellow by price tertile, size by trade volume. */
export function buildStyledMapMarkers(
  complexes: ComplexSummary[],
  limit = 12,
): MarkerPoint[] {
  const withCoords = complexes
    .filter((c) => c.lat != null && c.lng != null && Number.isFinite(c.medianPrice))
    .slice(0, limit);

  if (withCoords.length === 0) return [];

  const prices = withCoords.map((c) => c.medianPrice).sort((a, b) => a - b);
  const { lowMax, midMax } = priceTier(prices);
  const counts = withCoords.map((c) => c.tradeCount || 0);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);

  return withCoords.map((c) => {
    const colors = tierForPrice(c.medianPrice, lowMax, midMax);
    const tradeCount = c.tradeCount || 0;
    const priceLabel = formatManwon(c.medianPrice);
    return {
      lat: c.lat!,
      lng: c.lng!,
      title: `${c.aptName} · ${priceLabel} · 거래 ${tradeCount}건`,
      priceLabel,
      tradeCount,
      radius: radiusForCount(tradeCount, minC, maxC),
      fillColor: colors.fill,
      strokeColor: colors.stroke,
    };
  });
}
