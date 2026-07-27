export interface ApartmentTrade {
  aptName: string;
  dong: string;
  jibun?: string;
  exclusiveArea: number;
  price: number;
  floor: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string;
  buildYear?: number;
  lawdCd: string;
  dealMonthKey: string;
  monthlyRent?: number;
  kind?: 'sale' | 'jeonse';
}

export interface MonthlyTrend {
  month: string;
  avgPrice: number;
  medianPrice: number;
  tradeCount: number;
}

export interface YearlyPricePoint {
  year: number;
  saleMedian: number | null;
  saleMin: number | null;
  saleMax: number | null;
  jeonseMedian: number | null;
  jeonseMin: number | null;
  jeonseMax: number | null;
  gap: number | null;
  gapMin: number | null;
  gapMax: number | null;
  saleCount: number;
  jeonseCount: number;
}

export interface AreaBand {
  targetM2: number;
  pyeong: number;
  label: string;
  saleCount: number;
  jeonseCount: number;
  tolerance: number;
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
  medianJeonse: number | null;
  jeonseCount: number;
  saleJeonseGap: number | null;
  yearly: YearlyPricePoint[];
  recentJeonseTrades: ApartmentTrade[];
}

export interface ReverseGeocodeResult {
  roadAddress: string | null;
  jibunAddress: string | null;
  region1: string;
  region2: string;
  region3: string;
  /** MOLIT 시군구 코드(5자리) — 도시 구 / 지방 시·군 */
  lawdCd: string;
  /** 조사 범위 표시용 (예: 서울특별시 강남구) */
  sigunguLabel?: string;
  lat: number;
  lng: number;
  mock?: boolean;
}

export interface TradesResponse {
  lawdCd: string;
  months: string[];
  tradeCount: number;
  jeonseCount?: number;
  complexCount: number;
  complexes: ComplexSummary[];
  areaBands?: AreaBand[];
  selectedAreaTarget?: number | null;
  mock?: boolean;
}

export interface UserLocation {
  lat: number;
  lng: number;
}
