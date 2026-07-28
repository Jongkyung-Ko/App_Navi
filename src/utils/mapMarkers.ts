import type { ComplexSummary } from '../types';
import { formatManwonCompact, formatPyeongPrice } from './format';

export type MapPriceMode = 'sale' | 'pyeong';

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

/** Soft heat blob for 평단가 mode (meters + 0..1 intensity). */
export interface HeatPoint {
  lat: number;
  lng: number;
  /** 0..1 normalized heat */
  intensity: number;
  /** Blob radius in meters */
  radiusM: number;
  fillColor: string;
  title?: string;
}

const TIER = {
  high: { fill: 'rgba(220, 38, 38, 0.55)', stroke: 'rgba(185, 28, 28, 0.9)' },
  mid: { fill: 'rgba(234, 88, 12, 0.55)', stroke: 'rgba(194, 65, 12, 0.9)' },
  low: { fill: 'rgba(234, 179, 8, 0.55)', stroke: 'rgba(202, 138, 4, 0.9)' },
} as const;

const RADIUS_MIN = 10;
const RADIUS_MAX = 22;
const TOP_N = 10;
const HEAT_MIN_M = 140;
const HEAT_MAX_M = 260;

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

/** Teal → yellow → orange → red for continuous heat (hex). */
export function heatFillColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  let r: number;
  let g: number;
  let b: number;
  if (x < 0.33) {
    const u = x / 0.33;
    r = Math.round(20 + u * (234 - 20));
    g = Math.round(184 + u * (179 - 184));
    b = Math.round(166 + u * (8 - 166));
  } else if (x < 0.66) {
    const u = (x - 0.33) / 0.33;
    r = 234;
    g = Math.round(179 + u * (88 - 179));
    b = Math.round(8 + u * (12 - 8));
  } else {
    const u = (x - 0.66) / 0.34;
    r = Math.round(234 + u * (220 - 234));
    g = Math.round(88 + u * (38 - 88));
    b = Math.round(12 + u * (38 - 12));
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Style map spots (시세 mode):
 * - Rank by sale price, take Top 10 → split into high/mid/low (red/orange/yellow)
 * - Everything outside Top 10 → low (yellow)
 * - Circle size scales with trade volume among visible markers
 */
export function buildStyledMapMarkers(
  complexes: ComplexSummary[],
  limit = 20,
): MarkerPoint[] {
  const withCoords = complexes
    .filter((c) => c.lat != null && c.lng != null && Number.isFinite(c.medianPrice) && c.medianPrice > 0)
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

/**
 * Soft overlapping heat blobs from 매매 평단가 (평단가 mode).
 */
export function buildPyeongHeatPoints(
  complexes: ComplexSummary[],
  limit = 60,
): HeatPoint[] {
  const withCoords = complexes
    .filter(
      (c) =>
        c.lat != null &&
        c.lng != null &&
        Number.isFinite(c.avgPricePerPyeong) &&
        c.avgPricePerPyeong > 0,
    )
    .sort((a, b) => b.avgPricePerPyeong - a.avgPricePerPyeong)
    .slice(0, limit);

  if (withCoords.length === 0) return [];

  const values = withCoords.map((c) => c.avgPricePerPyeong);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  return withCoords.map((c) => {
    const t = maxV <= minV ? 0.5 : (c.avgPricePerPyeong - minV) / (maxV - minV);
    const radiusM = Math.round(HEAT_MIN_M + t * (HEAT_MAX_M - HEAT_MIN_M));
    const label = formatPyeongPrice(c.avgPricePerPyeong);
    return {
      lat: c.lat!,
      lng: c.lng!,
      intensity: t,
      radiusM,
      fillColor: heatFillColor(t),
      title: `${c.aptName} · ${label}`,
    };
  });
}

/** Sort complexes by median sale price, highest first. */
export function sortBySalePriceDesc(items: ComplexSummary[]): ComplexSummary[] {
  return [...items].sort((a, b) => (b.medianPrice || 0) - (a.medianPrice || 0));
}
