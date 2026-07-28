import { fetchTradesForMonths } from './molit.js';
import {
  average,
  complexId,
  median,
  recentYearMonths,
  type ApartmentTrade,
} from '../types.js';

export interface LeaderComplex {
  rank: number;
  id: string;
  aptName: string;
  dong: string;
  medianPrice: number;
  avgPrice: number;
  avgPricePerPyeong: number;
  tradeCount: number;
  rankingTradeCount: number;
}

export interface LeaderMonthPoint {
  month: string;
  avgMedian: number | null;
  sampleCount: number;
  momChangePercent: number | null;
}

export interface SurgeInterval {
  startMonth: string;
  endMonth: string;
  startPrice: number;
  endPrice: number;
  changePercent: number;
}

export interface LeaderIndexResult {
  lawdCd: string;
  topN: number;
  years: number;
  months: string[];
  tradeCount: number;
  leaders: LeaderComplex[];
  monthly: LeaderMonthPoint[];
  surges: SurgeInterval[];
  surgeThresholdPercent: number;
  summary: string;
  mock?: boolean;
}

function monthKey(t: ApartmentTrade): string {
  return `${t.dealYear}-${String(t.dealMonth).padStart(2, '0')}`;
}

function pricePerPyeong(price: number, exclusiveArea: number): number {
  if (!exclusiveArea) return 0;
  return price / (exclusiveArea / 3.3058);
}

function displayMonths(count: number, from = new Date()): string[] {
  const keys = recentYearMonths(count, from);
  return [...keys].reverse().map((ym) => `${ym.slice(0, 4)}-${ym.slice(4, 6)}`);
}

/**
 * Detect price-jump intervals on a monthly average series.
 * A surge starts when MoM rise ≥ threshold (default 3%).
 */
export function detectSurgeIntervals(
  monthly: LeaderMonthPoint[],
  thresholdPercent = 3,
): SurgeInterval[] {
  const surges: SurgeInterval[] = [];
  let active: SurgeInterval | null = null;

  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1];
    const curr = monthly[i];
    const mom = curr.momChangePercent;
    const rising = mom !== null && mom >= thresholdPercent;

    if (rising && prev.avgMedian != null && curr.avgMedian != null) {
      if (!active) {
        active = {
          startMonth: prev.month,
          endMonth: curr.month,
          startPrice: prev.avgMedian,
          endPrice: curr.avgMedian,
          changePercent: 0,
        };
      } else {
        active.endMonth = curr.month;
        active.endPrice = curr.avgMedian;
      }
      active.changePercent =
        active.startPrice > 0
          ? ((active.endPrice - active.startPrice) / active.startPrice) * 100
          : 0;
    } else if (active) {
      const next = monthly[i + 1];
      const nextRising =
        next?.momChangePercent != null && next.momChangePercent >= thresholdPercent;
      const mildBridge = mom !== null && mom > -1 && nextRising;

      if (mildBridge && curr.avgMedian != null) {
        active.endMonth = curr.month;
        active.endPrice = curr.avgMedian;
        active.changePercent =
          active.startPrice > 0
            ? ((active.endPrice - active.startPrice) / active.startPrice) * 100
            : 0;
      } else {
        surges.push(active);
        active = null;
      }
    }
  }

  if (active) surges.push(active);

  return surges.filter(
    (s) => s.changePercent >= thresholdPercent || s.startMonth !== s.endMonth,
  );
}

export function buildLeaderIndexFromSales(
  sales: ApartmentTrade[],
  options: {
    topN: number;
    years: number;
    surgeThresholdPercent: number;
    minRankingTrades?: number;
  },
): Omit<LeaderIndexResult, 'lawdCd' | 'mock'> {
  const { topN, years, surgeThresholdPercent } = options;
  const minRankingTrades = options.minRankingTrades ?? 3;
  const monthLabels = displayMonths(years * 12);
  const rankingMonths = new Set(monthLabels.slice(-12));

  const byComplex = new Map<string, ApartmentTrade[]>();
  for (const t of sales) {
    const id = complexId(t.aptName, t.dong);
    const list = byComplex.get(id) ?? [];
    list.push(t);
    byComplex.set(id, list);
  }

  const candidates: LeaderComplex[] = [];
  for (const [id, list] of byComplex) {
    const rankingTrades = list.filter((t) => rankingMonths.has(monthKey(t)));
    const rankingPrices = rankingTrades.map((t) => t.price);
    if (rankingPrices.length < minRankingTrades) continue;

    const sample = list[0];
    const pyeong = rankingTrades.map((t) => pricePerPyeong(t.price, t.exclusiveArea));

    candidates.push({
      rank: 0,
      id,
      aptName: sample.aptName,
      dong: sample.dong,
      medianPrice: median(rankingPrices),
      avgPrice: average(rankingPrices),
      avgPricePerPyeong: pyeong.length ? average(pyeong) : 0,
      tradeCount: list.length,
      rankingTradeCount: rankingPrices.length,
    });
  }

  candidates.sort((a, b) => b.medianPrice - a.medianPrice);
  const leaders = candidates.slice(0, topN).map((c, i) => ({ ...c, rank: i + 1 }));
  const leaderIds = new Set(leaders.map((l) => l.id));

  const rawByComplexMonth = new Map<string, Map<string, number[]>>();
  for (const t of sales) {
    const id = complexId(t.aptName, t.dong);
    if (!leaderIds.has(id)) continue;
    const mk = monthKey(t);
    let monthMap = rawByComplexMonth.get(id);
    if (!monthMap) {
      monthMap = new Map();
      rawByComplexMonth.set(id, monthMap);
    }
    const arr = monthMap.get(mk) ?? [];
    arr.push(t.price);
    monthMap.set(mk, arr);
  }

  const complexMonthMedian = new Map<string, Map<string, number>>();
  for (const [id, monthMap] of rawByComplexMonth) {
    const medians = new Map<string, number>();
    for (const [mk, vals] of monthMap) {
      medians.set(mk, median(vals));
    }
    complexMonthMedian.set(id, medians);
  }

  const monthly: LeaderMonthPoint[] = monthLabels.map((month) => {
    const vals: number[] = [];
    for (const id of leaderIds) {
      const m = complexMonthMedian.get(id)?.get(month);
      if (m !== undefined) vals.push(m);
    }
    return {
      month,
      avgMedian: vals.length ? average(vals) : null,
      sampleCount: vals.length,
      momChangePercent: null,
    };
  });

  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1].avgMedian;
    const curr = monthly[i].avgMedian;
    if (prev != null && curr != null && prev > 0) {
      monthly[i].momChangePercent = ((curr - prev) / prev) * 100;
    }
  }

  const surges = detectSurgeIntervals(monthly, surgeThresholdPercent);

  const withData = monthly.filter((m) => m.avgMedian != null);
  const first = withData[0]?.avgMedian;
  const last = withData.at(-1)?.avgMedian;
  const totalChange =
    first != null && last != null && first > 0 ? ((last - first) / first) * 100 : null;

  const surgeText =
    surges.length === 0
      ? '뚜렷한 급등 구간은 감지되지 않았습니다.'
      : `급등 구간 ${surges.length}곳: ${surges
          .map((s) => `${s.startMonth}→${s.endMonth}(+${s.changePercent.toFixed(1)}%)`)
          .join(', ')}`;

  const summary =
    leaders.length === 0
      ? '선정 기준을 만족하는 대장 단지가 부족합니다.'
      : `대장 ${leaders.length}개 단지 평균 중위가 기준, 최근 ${years}년 변화 ${
          totalChange == null ? 'N/A' : `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%`
        }. ${surgeText}`;

  return {
    topN,
    years,
    months: recentYearMonths(years * 12),
    tradeCount: sales.length,
    leaders,
    monthly,
    surges,
    surgeThresholdPercent,
    summary,
  };
}

export async function computeLeaderIndex(params: {
  lawdCd: string;
  topN?: number;
  years?: number;
  surgeThresholdPercent?: number;
  areaTarget?: number;
  areaTolerance?: number;
}): Promise<LeaderIndexResult> {
  const topN = Math.min(20, Math.max(3, Math.round(params.topN ?? 10)));
  const years = Math.min(5, Math.max(1, Math.round(params.years ?? 3)));
  const surgeThresholdPercent = Math.min(
    15,
    Math.max(1, Number(params.surgeThresholdPercent ?? 3)),
  );
  const monthKeys = recentYearMonths(years * 12);

  // Sale-only: jeonse not needed for leader price index
  const sales = await fetchTradesForMonths(params.lawdCd, monthKeys, 8);

  let filtered = sales;
  if (params.areaTarget !== undefined && Number.isFinite(params.areaTarget)) {
    const tol = params.areaTolerance ?? 7;
    filtered = sales.filter(
      (t) => Math.abs(t.exclusiveArea - params.areaTarget!) <= tol,
    );
  }

  const built = buildLeaderIndexFromSales(filtered, {
    topN,
    years,
    surgeThresholdPercent,
  });

  return {
    lawdCd: params.lawdCd,
    ...built,
    mock: process.env.MOLIT_SERVICE_KEY?.startsWith('your_') === true,
  };
}
