export interface ApartmentTrade {
  aptName: string;
  dong: string;
  jibun?: string;
  exclusiveArea: number;
  price: number; // 만원 단위
  floor: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string; // YYYY-MM-DD
  buildYear?: number;
  lawdCd: string;
  dealMonthKey: string; // YYYYMM
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
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  avgPrice: number;
  medianPrice: number;
  tradeCount: number;
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

export function aggregateComplexes(
  trades: ApartmentTrade[],
  areaFilter?: { target: number; tolerance: number },
): ComplexSummary[] {
  let filtered = trades;
  if (areaFilter) {
    filtered = trades.filter(
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

  const summaries: ComplexSummary[] = [];
  for (const [id, list] of groups) {
    const prices = list.map((t) => t.price);
    const pyeongPrices = list.map((t) => pricePerPyeong(t.price, t.exclusiveArea));
    const areas = list.map((t) => t.exclusiveArea);
    const latestDealDate = [...list]
      .map((t) => t.dealDate)
      .sort()
      .at(-1)!;

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
    const sample = list[0];

    summaries.push({
      id,
      aptName: sample.aptName,
      dong: sample.dong,
      tradeCount: list.length,
      avgPrice: average(prices),
      medianPrice: median(prices),
      avgPricePerPyeong: average(pyeongPrices),
      latestDealDate,
      minArea: Math.min(...areas),
      maxArea: Math.max(...areas),
      monthly,
      recentTrades: [...list]
        .sort((a, b) => b.dealDate.localeCompare(a.dealDate))
        .slice(0, 20),
      trendSummary: text,
      changePercent: pct,
    });
  }

  return summaries.sort((a, b) => b.tradeCount - a.tradeCount);
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
