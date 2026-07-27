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
}

export interface MonthlyTrend {
  month: string;
  avgPrice: number;
  medianPrice: number;
  tradeCount: number;
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

export interface TradesResponse {
  lawdCd: string;
  months: string[];
  tradeCount: number;
  complexCount: number;
  complexes: ComplexSummary[];
  mock?: boolean;
}

export interface UserLocation {
  lat: number;
  lng: number;
}
