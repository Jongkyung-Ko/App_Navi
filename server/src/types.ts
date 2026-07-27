export interface ApartmentTrade {
  aptName: string;
  dong: string;
  jibun?: string;
  exclusiveArea: number;
  price: number; // 만원 (매매가 또는 전세 보증금)
  floor: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string; // YYYY-MM-DD
  buildYear?: number;
  lawdCd: string;
  dealMonthKey: string; // YYYYMM
  /** 전월세 API: 월세(만원). 0이면 순수 전세 */
  monthlyRent?: number;
  kind?: 'sale' | 'jeonse';
}

export interface ComplexSummary {
  id: string;
  aptName: string;
  dong: string;
  tradeCount: number;
  avgPrice: number;
  medianPrice: number;
  avgPricePerPyeong: number;
  latestDealDate: string;
  minArea: number;
  maxArea: number;
  lat?: number;
  lng?: number;
  monthly: MonthlyTrend[];
  recentTrades: ApartmentTrade[];
  trendSummary: string;
  changePercent: number | null;
  /** 최근 구간 전세 중위 보증금(만원) */
  medianJeonse: number | null;
  jeonseCount: number;
  /** 매매 중위 - 전세 중위 (둘 다 있을 때) */
  saleJeonseGap: number | null;
  /** 최근 10년 연도별 매매/전세/차이 */
  yearly: YearlyPricePoint[];
  recentJeonseTrades: ApartmentTrade[];
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  avgPrice: number;
  medianPrice: number;
  tradeCount: number;
}

export interface YearlyPricePoint {
  year: number;
  saleMedian: number | null;
  jeonseMedian: number | null;
  gap: number | null;
  saleCount: number;
  jeonseCount: number;
}

export interface ReverseGeocodeResult {
  roadAddress: string | null;
  jibunAddress: string | null;
  region1: string;
  region2: string;
  region3: string;
  lawdCd: string;
  lat: number;
  lng: number;
  mock?: boolean;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 전용면적(㎡) → 평당가(만원/평). 1평 ≈ 3.3058㎡ */
export function pricePerPyeong(priceManwon: number, exclusiveAreaM2: number): number {
  if (!exclusiveAreaM2 || exclusiveAreaM2 <= 0) return 0;
  const pyeong = exclusiveAreaM2 / 3.3058;
  return priceManwon / pyeong;
}

export function changePercent(from: number, to: number): number | null {
  if (!from || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function formatTrendSummary(
  monthly: MonthlyTrend[],
  tradeCount: number,
): { text: string; changePercent: number | null } {
  const withData = monthly.filter((m) => m.tradeCount > 0);
  if (withData.length === 0) {
    return { text: '최근 거래 데이터가 없습니다.', changePercent: null };
  }
  if (withData.length === 1) {
    const m = withData[0];
    return {
      text: `${m.month} 중위가 ${Math.round(m.medianPrice).toLocaleString('ko-KR')}만 · 거래 ${tradeCount}건`,
      changePercent: null,
    };
  }
  const first = withData[0];
  const last = withData[withData.length - 1];
  const pct = changePercent(first.medianPrice, last.medianPrice);
  const arrow = pct === null ? '' : pct > 0 ? ` (+${pct.toFixed(1)}%)` : ` (${pct.toFixed(1)}%)`;
  return {
    text: `최근 ${withData.length}개월 중위가 ${Math.round(first.medianPrice).toLocaleString('ko-KR')}만 → ${Math.round(last.medianPrice).toLocaleString('ko-KR')}만${arrow} · 거래 ${tradeCount}건`,
    changePercent: pct,
  };
}

export function complexId(aptName: string, dong: string): string {
  return `${dong.trim()}::${aptName.trim()}`;
}

export function buildYearlyComparison(
  saleTrades: ApartmentTrade[],
  jeonseTrades: ApartmentTrade[],
  yearCount = 10,
  from = new Date(),
): YearlyPricePoint[] {
  const endYear = from.getFullYear();
  const startYear = endYear - yearCount + 1;
  const points: YearlyPricePoint[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const sales = saleTrades.filter((t) => t.dealYear === year).map((t) => t.price);
    const rents = jeonseTrades.filter((t) => t.dealYear === year).map((t) => t.price);
    const saleMedian = sales.length ? median(sales) : null;
    const jeonseMedian = rents.length ? median(rents) : null;
    const gap =
      saleMedian !== null && jeonseMedian !== null ? saleMedian - jeonseMedian : null;
    points.push({
      year,
      saleMedian,
      jeonseMedian,
      gap,
      saleCount: sales.length,
      jeonseCount: rents.length,
    });
  }
  return points;
}

export function aggregateComplexes(
  trades: ApartmentTrade[],
  areaFilter?: { target: number; tolerance: number },
  jeonseTrades: ApartmentTrade[] = [],
  options?: { yearCount?: number },
): ComplexSummary[] {
  let filtered = trades;
  let filteredJeonse = jeonseTrades;
  if (areaFilter) {
    filtered = trades.filter(
      (t) => Math.abs(t.exclusiveArea - areaFilter.target) <= areaFilter.tolerance,
    );
    filteredJeonse = jeonseTrades.filter(
      (t) => Math.abs(t.exclusiveArea - areaFilter.target) <= areaFilter.tolerance,
    );
  }

  const groups = new Map<string, ApartmentTrade[]>();
  for (const trade of filtered) {
    const id = complexId(trade.aptName, trade.dong);
    const list = groups.get(id) ?? [];
    list.push(trade);
    groups.set(id, list);
  }

  const jeonseById = new Map<string, ApartmentTrade[]>();
  for (const rent of filteredJeonse) {
    const id = complexId(rent.aptName, rent.dong);
    const list = jeonseById.get(id) ?? [];
    list.push(rent);
    jeonseById.set(id, list);
  }

  // Include jeonse-only complexes if they appear in rent data
  for (const id of jeonseById.keys()) {
    if (!groups.has(id)) {
      groups.set(id, []);
    }
  }

  const yearCount = options?.yearCount ?? 10;
  const summaries: ComplexSummary[] = [];

  for (const [id, list] of groups) {
    const rents = jeonseById.get(id) ?? [];
    const sample = list[0] ?? rents[0];
    if (!sample) continue;

    const prices = list.map((t) => t.price);
    const pyeongPrices = list.map((t) => pricePerPyeong(t.price, t.exclusiveArea));
    const areas = [
      ...list.map((t) => t.exclusiveArea),
      ...rents.map((t) => t.exclusiveArea),
    ].filter((a) => a > 0);
    const latestDealDate =
      [...list, ...rents].map((t) => t.dealDate).sort().at(-1) ?? '';

    const monthMap = new Map<string, number[]>();
    for (const t of list) {
      const key = `${t.dealYear}-${String(t.dealMonth).padStart(2, '0')}`;
      const arr = monthMap.get(key) ?? [];
      arr.push(t.price);
      monthMap.set(key, arr);
    }
    const monthly: MonthlyTrend[] = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        avgPrice: average(vals),
        medianPrice: median(vals),
        tradeCount: vals.length,
      }));

    const { text, changePercent: pct } = formatTrendSummary(monthly, list.length);
    const medianPrice = prices.length ? median(prices) : 0;
    const medianJeonse = rents.length ? median(rents.map((r) => r.price)) : null;
    const saleJeonseGap =
      prices.length && medianJeonse !== null ? medianPrice - medianJeonse : null;
    const yearly = buildYearlyComparison(list, rents, yearCount);

    summaries.push({
      id,
      aptName: sample.aptName,
      dong: sample.dong,
      tradeCount: list.length,
      avgPrice: prices.length ? average(prices) : 0,
      medianPrice,
      avgPricePerPyeong: pyeongPrices.length ? average(pyeongPrices) : 0,
      latestDealDate,
      minArea: areas.length ? Math.min(...areas) : 0,
      maxArea: areas.length ? Math.max(...areas) : 0,
      monthly,
      recentTrades: [...list]
        .sort((a, b) => b.dealDate.localeCompare(a.dealDate))
        .slice(0, 20),
      trendSummary: text,
      changePercent: pct,
      medianJeonse,
      jeonseCount: rents.length,
      saleJeonseGap,
      yearly,
      recentJeonseTrades: [...rents]
        .sort((a, b) => b.dealDate.localeCompare(a.dealDate))
        .slice(0, 20),
    });
  }

  return summaries.sort(
    (a, b) => b.tradeCount + b.jeonseCount - (a.tradeCount + a.jeonseCount),
  );
}

export function recentYearMonths(count: number, from = new Date()): string[] {
  const result: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${y}${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
