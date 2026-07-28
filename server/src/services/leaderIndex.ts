import { fetchSaleAndJeonseForMonths } from './molit.js';
import {
  average,
  complexId,
  median,
  recentYearMonths,
  type ApartmentTrade,
} from '../types.js';

/** Major exclusive-area bands for GapGapGap analysis (㎡) */
export const ANALYSIS_AREA_TARGETS = [59, 74, 79, 84, 99] as const;

export interface LeaderComplex {
  rank: number;
  id: string;
  aptName: string;
  dong: string;
  /** Absolute median sale price (만원) in ranking window */
  medianPrice: number;
  avgPrice: number;
  /** Ranking metric: median 평단가 (만원/평) */
  avgPricePerPyeong: number;
  medianPricePerPyeong: number;
  medianJeonsePerPyeong: number | null;
  saleJeonseGapPerPyeong: number | null;
  tradeCount: number;
  rankingTradeCount: number;
  jeonseRankingCount: number;
}

export interface LeaderMonthPoint {
  month: string;
  /** Median-of-leaders value for this series (만원/평 or 만원) */
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
  jeonseCount: number;
  /** Exclusive-area band used for filtering (㎡) */
  areaTarget: number;
  areaTolerance: number;
  /** Always pyeong for GapGapGap analysis */
  metric: 'pyeong';
  leaders: LeaderComplex[];
  /** @deprecated use monthlySale — kept for older clients */
  monthly: LeaderMonthPoint[];
  monthlySale: LeaderMonthPoint[];
  monthlyJeonse: LeaderMonthPoint[];
  monthlyGap: LeaderMonthPoint[];
  surges: SurgeInterval[];
  surgeThresholdPercent: number;
  summary: string;
  mock?: boolean;
}

function monthKey(t: ApartmentTrade): string {
  return `${t.dealYear}-${String(t.dealMonth).padStart(2, '0')}`;
}

export function pricePerPyeong(price: number, exclusiveArea: number): number {
  if (!exclusiveArea) return 0;
  return price / (exclusiveArea / 3.3058);
}

function displayMonths(count: number, from = new Date()): string[] {
  const keys = recentYearMonths(count, from);
  return [...keys].reverse().map((ym) => `${ym.slice(0, 4)}-${ym.slice(4, 6)}`);
}

function filterByArea(
  trades: ApartmentTrade[],
  areaTarget: number,
  areaTolerance: number,
): ApartmentTrade[] {
  return trades.filter(
    (t) => t.exclusiveArea > 0 && Math.abs(t.exclusiveArea - areaTarget) <= areaTolerance,
  );
}

function attachMom(monthly: LeaderMonthPoint[]): LeaderMonthPoint[] {
  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1].avgMedian;
    const curr = monthly[i].avgMedian;
    if (prev != null && curr != null && prev > 0) {
      monthly[i].momChangePercent = ((curr - prev) / prev) * 100;
    }
  }
  return monthly;
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

function buildComplexMonthPyeong(
  trades: ApartmentTrade[],
  leaderIds: Set<string>,
): Map<string, Map<string, number>> {
  const raw = new Map<string, Map<string, number[]>>();
  for (const t of trades) {
    const id = complexId(t.aptName, t.dong);
    if (!leaderIds.has(id)) continue;
    const py = pricePerPyeong(t.price, t.exclusiveArea);
    if (!py) continue;
    const mk = monthKey(t);
    let monthMap = raw.get(id);
    if (!monthMap) {
      monthMap = new Map();
      raw.set(id, monthMap);
    }
    const arr = monthMap.get(mk) ?? [];
    arr.push(py);
    monthMap.set(mk, arr);
  }

  const out = new Map<string, Map<string, number>>();
  for (const [id, monthMap] of raw) {
    const medians = new Map<string, number>();
    for (const [mk, vals] of monthMap) {
      medians.set(mk, median(vals));
    }
    out.set(id, medians);
  }
  return out;
}

function averageLeadersByMonth(
  monthLabels: string[],
  leaderIds: Set<string>,
  complexMonth: Map<string, Map<string, number>>,
): LeaderMonthPoint[] {
  return attachMom(
    monthLabels.map((month) => {
      const vals: number[] = [];
      for (const id of leaderIds) {
        const m = complexMonth.get(id)?.get(month);
        if (m !== undefined) vals.push(m);
      }
      return {
        month,
        avgMedian: vals.length ? average(vals) : null,
        sampleCount: vals.length,
        momChangePercent: null,
      };
    }),
  );
}

function gapSeries(
  sale: LeaderMonthPoint[],
  jeonse: LeaderMonthPoint[],
): LeaderMonthPoint[] {
  return attachMom(
    sale.map((s, i) => {
      const j = jeonse[i];
      const gap =
        s.avgMedian != null && j?.avgMedian != null ? s.avgMedian - j.avgMedian : null;
      return {
        month: s.month,
        avgMedian: gap,
        sampleCount: s.sampleCount > 0 && (j?.sampleCount ?? 0) > 0 ? 1 : 0,
        momChangePercent: null,
      };
    }),
  );
}

export function buildLeaderIndexFromTrades(
  sales: ApartmentTrade[],
  jeonse: ApartmentTrade[],
  options: {
    topN: number;
    years: number;
    surgeThresholdPercent: number;
    minRankingTrades?: number;
    areaTarget: number;
    areaTolerance: number;
  },
): Omit<LeaderIndexResult, 'lawdCd' | 'mock'> {
  const {
    topN,
    years,
    surgeThresholdPercent,
    areaTarget,
    areaTolerance,
  } = options;
  const minRankingTrades = options.minRankingTrades ?? 3;
  const monthLabels = displayMonths(years * 12);
  const rankingMonths = new Set(monthLabels.slice(-12));

  const filteredSales = filterByArea(sales, areaTarget, areaTolerance);
  const filteredJeonse = filterByArea(jeonse, areaTarget, areaTolerance);

  const byComplex = new Map<string, ApartmentTrade[]>();
  for (const t of filteredSales) {
    const id = complexId(t.aptName, t.dong);
    const list = byComplex.get(id) ?? [];
    list.push(t);
    byComplex.set(id, list);
  }

  const jeonseByComplex = new Map<string, ApartmentTrade[]>();
  for (const t of filteredJeonse) {
    const id = complexId(t.aptName, t.dong);
    const list = jeonseByComplex.get(id) ?? [];
    list.push(t);
    jeonseByComplex.set(id, list);
  }

  const candidates: LeaderComplex[] = [];
  for (const [id, list] of byComplex) {
    const rankingTrades = list.filter((t) => rankingMonths.has(monthKey(t)));
    const rankingPyeong = rankingTrades
      .map((t) => pricePerPyeong(t.price, t.exclusiveArea))
      .filter((v) => v > 0);
    if (rankingPyeong.length < minRankingTrades) continue;

    const sample = list[0];
    const rankingPrices = rankingTrades.map((t) => t.price);
    const rents = (jeonseByComplex.get(id) ?? []).filter((t) =>
      rankingMonths.has(monthKey(t)),
    );
    const rentPyeong = rents
      .map((t) => pricePerPyeong(t.price, t.exclusiveArea))
      .filter((v) => v > 0);
    const medianSalePy = median(rankingPyeong);
    const medianJeonsePy = rentPyeong.length ? median(rentPyeong) : null;

    candidates.push({
      rank: 0,
      id,
      aptName: sample.aptName,
      dong: sample.dong,
      medianPrice: rankingPrices.length ? median(rankingPrices) : 0,
      avgPrice: rankingPrices.length ? average(rankingPrices) : 0,
      avgPricePerPyeong: average(rankingPyeong),
      medianPricePerPyeong: medianSalePy,
      medianJeonsePerPyeong: medianJeonsePy,
      saleJeonseGapPerPyeong:
        medianJeonsePy != null ? medianSalePy - medianJeonsePy : null,
      tradeCount: list.length,
      rankingTradeCount: rankingPyeong.length,
      jeonseRankingCount: rentPyeong.length,
    });
  }

  // Rank by 평단가 (not absolute price)
  candidates.sort((a, b) => b.medianPricePerPyeong - a.medianPricePerPyeong);
  const leaders = candidates.slice(0, topN).map((c, i) => ({ ...c, rank: i + 1 }));
  const leaderIds = new Set(leaders.map((l) => l.id));

  const saleByComplexMonth = buildComplexMonthPyeong(filteredSales, leaderIds);
  const jeonseByComplexMonth = buildComplexMonthPyeong(filteredJeonse, leaderIds);

  const monthlySale = averageLeadersByMonth(monthLabels, leaderIds, saleByComplexMonth);
  const monthlyJeonse = averageLeadersByMonth(
    monthLabels,
    leaderIds,
    jeonseByComplexMonth,
  );
  const monthlyGap = gapSeries(monthlySale, monthlyJeonse);
  const surges = detectSurgeIntervals(monthlySale, surgeThresholdPercent);

  const withData = monthlySale.filter((m) => m.avgMedian != null);
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
      ? `${areaTarget}㎡ 밴드에서 선정 기준을 만족하는 대장 단지가 부족합니다.`
      : `${areaTarget}㎡ 평단가 기준 대장 ${leaders.length}개, 최근 ${years}년 매매평단 변화 ${
          totalChange == null ? 'N/A' : `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%`
        }. ${surgeText}`;

  return {
    topN,
    years,
    months: recentYearMonths(years * 12),
    tradeCount: filteredSales.length,
    jeonseCount: filteredJeonse.length,
    areaTarget,
    areaTolerance,
    metric: 'pyeong',
    leaders,
    monthly: monthlySale,
    monthlySale,
    monthlyJeonse,
    monthlyGap,
    surges,
    surgeThresholdPercent,
    summary,
  };
}

/** @deprecated prefer buildLeaderIndexFromTrades */
export function buildLeaderIndexFromSales(
  sales: ApartmentTrade[],
  options: {
    topN: number;
    years: number;
    surgeThresholdPercent: number;
    minRankingTrades?: number;
    areaTarget?: number;
    areaTolerance?: number;
  },
): Omit<LeaderIndexResult, 'lawdCd' | 'mock'> {
  return buildLeaderIndexFromTrades(sales, [], {
    ...options,
    areaTarget: options.areaTarget ?? 84,
    areaTolerance: options.areaTolerance ?? 7,
  });
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
  const areaTarget = Number.isFinite(params.areaTarget)
    ? Number(params.areaTarget)
    : 84;
  const areaTolerance = Number.isFinite(params.areaTolerance)
    ? Number(params.areaTolerance)
    : 7;
  const monthKeys = recentYearMonths(years * 12);

  const { sales, jeonse } = await fetchSaleAndJeonseForMonths(
    params.lawdCd,
    monthKeys,
    8,
  );

  const built = buildLeaderIndexFromTrades(sales, jeonse, {
    topN,
    years,
    surgeThresholdPercent,
    areaTarget,
    areaTolerance,
  });

  return {
    lawdCd: params.lawdCd,
    ...built,
    mock: process.env.MOLIT_SERVICE_KEY?.startsWith('your_') === true,
  };
}
