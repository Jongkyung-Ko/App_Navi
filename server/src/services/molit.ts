import { XMLParser } from 'fast-xml-parser';
import type { ApartmentTrade } from '../types.js';
import { cacheGet, cacheSet } from './cache.js';

const MOLIT_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  isArray: (name) => name === 'item',
});

function parsePrice(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const cleaned = String(raw).replace(/,/g, '').trim();
  return Number.parseInt(cleaned, 10) || 0;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mockTrades(lawdCd: string, dealYmd: string): ApartmentTrade[] {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6));
  const base = [
    { aptName: '남산타워아파트', dong: '중구 회현동', area: 84.9, price: 98000 },
    { aptName: '남산타워아파트', dong: '중구 회현동', area: 59.8, price: 72000 },
    { aptName: '서울센트럴아이파크', dong: '중구 순화동', area: 84.98, price: 185000 },
    { aptName: '서울센트럴아이파크', dong: '중구 순화동', area: 114.7, price: 245000 },
    { aptName: '남산롯데캐슬아이러브', dong: '중구 회현동2가', area: 84.93, price: 168000 },
  ];

  const monthIdx = month;
  return base.map((b, i) => {
    const drift = (monthIdx % 6) * 500 + i * 200;
    const day = Math.min(28, 3 + i * 4);
    return {
      aptName: b.aptName,
      dong: b.dong,
      exclusiveArea: b.area,
      price: b.price + drift,
      floor: 5 + i,
      dealYear: year,
      dealMonth: month,
      dealDay: day,
      dealDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      buildYear: 2010 + i,
      lawdCd,
      dealMonthKey: dealYmd,
      jibun: `${10 + i}`,
    };
  });
}

function normalizeItem(item: Record<string, unknown>, lawdCd: string, dealYmd: string): ApartmentTrade | null {
  const aptName = String(item.aptNm ?? item.아파트 ?? '').trim();
  if (!aptName) return null;

  const year = Number(item.dealYear ?? item.년 ?? dealYmd.slice(0, 4));
  const month = Number(item.dealMonth ?? item.월 ?? dealYmd.slice(4, 6));
  const day = Number(item.dealDay ?? item.일 ?? 1);
  const price = parsePrice((item.dealAmount ?? item.거래금액) as string | number);

  return {
    aptName,
    dong: String(item.umdNm ?? item.법정동 ?? '').trim(),
    jibun: item.jibun ? String(item.jibun) : item.지번 ? String(item.지번) : undefined,
    exclusiveArea: Number(item.excluUseAr ?? item.전용면적 ?? 0),
    price,
    floor: Number(item.floor ?? item.층 ?? 0),
    dealYear: year,
    dealMonth: month,
    dealDay: day,
    dealDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    buildYear: item.buildYear || item.건축년도 ? Number(item.buildYear ?? item.건축년도) : undefined,
    lawdCd: String(item.sggCd ?? item.지역코드 ?? lawdCd).slice(0, 5),
    dealMonthKey: dealYmd,
  };
}

export async function fetchTradesForMonth(lawdCd: string, dealYmd: string): Promise<ApartmentTrade[]> {
  const cacheKey = `molit:${lawdCd}:${dealYmd}`;
  const cached = cacheGet<ApartmentTrade[]>(cacheKey);
  if (cached) return cached;

  const serviceKey = process.env.MOLIT_SERVICE_KEY;
  const allowMock = process.env.ALLOW_MOCK_FALLBACK !== 'false';

  if (!serviceKey || serviceKey.startsWith('your_')) {
    if (!allowMock) throw new Error('MOLIT_SERVICE_KEY is not configured');
    const mock = mockTrades(lawdCd, dealYmd);
    cacheSet(cacheKey, mock, 300);
    return mock;
  }

  const params = new URLSearchParams({
    serviceKey,
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: '1',
    numOfRows: '1000',
  });

  // data.go.kr keys are often already URL-encoded; avoid double-encoding
  const url = `${MOLIT_URL}?${params.toString().replace(/%25/g, '%')}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MOLIT API HTTP ${res.status}`);
  }

  const text = await res.text();
  let items: Record<string, unknown>[] = [];

  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const json = JSON.parse(text) as {
      response?: { body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } } };
    };
    items = asArray(json.response?.body?.items?.item);
  } else {
    const parsed = parser.parse(text) as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } };
      };
    };
    const code = parsed.response?.header?.resultCode;
    if (code && code !== '00' && code !== '000') {
      const msg = parsed.response?.header?.resultMsg ?? 'unknown';
      if (allowMock) {
        const mock = mockTrades(lawdCd, dealYmd);
        cacheSet(cacheKey, mock, 300);
        return mock;
      }
      throw new Error(`MOLIT API error: ${code} ${msg}`);
    }
    items = asArray(parsed.response?.body?.items?.item);
  }

  const trades = items
    .map((item) => normalizeItem(item, lawdCd, dealYmd))
    .filter((t): t is ApartmentTrade => t !== null);

  cacheSet(cacheKey, trades);
  return trades;
}

export async function fetchTradesForMonths(lawdCd: string, months: string[]): Promise<ApartmentTrade[]> {
  const batches = await Promise.all(months.map((m) => fetchTradesForMonth(lawdCd, m)));
  return batches.flat();
}
