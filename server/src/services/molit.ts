import { XMLParser } from 'fast-xml-parser';
import type { ApartmentTrade } from '../types.js';
import { mapPool } from '../types.js';
import { cacheGet, cacheSet } from './cache.js';
import { diskCacheGet, diskCacheSet, molitMonthTtlSeconds } from './diskCache.js';

function readCachedMonth(cacheKey: string): ApartmentTrade[] | undefined {
  const mem = cacheGet<ApartmentTrade[]>(cacheKey);
  if (mem) return mem;
  const disk = diskCacheGet<ApartmentTrade[]>(cacheKey);
  if (disk) {
    // Rehydrate memory for the remaining disk TTL window (cap at default mem TTL)
    const memTtl = Number(process.env.CACHE_TTL_SECONDS ?? 21600);
    cacheSet(cacheKey, disk, memTtl);
    return disk;
  }
  return undefined;
}

function writeCachedMonth(cacheKey: string, dealYmd: string, data: ApartmentTrade[]): void {
  const ttl = molitMonthTtlSeconds(dealYmd);
  cacheSet(cacheKey, data, ttl);
  diskCacheSet(cacheKey, data, ttl);
}

const MOLIT_TRADE_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const MOLIT_RENT_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';

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

function mockSales(lawdCd: string, dealYmd: string): ApartmentTrade[] {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6));
  const base = [
    { aptName: '남산타워아파트', dong: '중구 회현동', area: 84.9, price: 98000 },
    { aptName: '서울센트럴아이파크', dong: '중구 순화동', area: 84.98, price: 185000 },
    { aptName: '남산롯데캐슬아이러브', dong: '중구 회현동2가', area: 84.93, price: 168000 },
  ];
  return base.map((b, i) => {
    const drift = ((year - 2016) * 1200 + month * 80) + i * 200;
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
      kind: 'sale' as const,
    };
  });
}

function mockJeonse(lawdCd: string, dealYmd: string): ApartmentTrade[] {
  return mockSales(lawdCd, dealYmd).map((t) => ({
    ...t,
    price: Math.round(t.price * 0.62),
    kind: 'jeonse' as const,
    monthlyRent: 0,
    jibun: undefined,
  }));
}

function normalizeSaleItem(
  item: Record<string, unknown>,
  lawdCd: string,
  dealYmd: string,
): ApartmentTrade | null {
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
    kind: 'sale',
  };
}

/** 순수 전세만 (월세 0). 월세 끼인 건은 제외 */
function normalizeJeonseItem(
  item: Record<string, unknown>,
  lawdCd: string,
  dealYmd: string,
): ApartmentTrade | null {
  const aptName = String(item.aptNm ?? item.아파트 ?? '').trim();
  if (!aptName) return null;

  const monthlyRent = parsePrice((item.monthlyRent ?? item.월세) as string | number);
  if (monthlyRent > 0) return null;

  const deposit = parsePrice((item.deposit ?? item.보증금) as string | number);
  if (!deposit) return null;

  const year = Number(item.dealYear ?? item.년 ?? dealYmd.slice(0, 4));
  const month = Number(item.dealMonth ?? item.월 ?? dealYmd.slice(4, 6));
  const day = Number(item.dealDay ?? item.일 ?? 1);

  return {
    aptName,
    dong: String(item.umdNm ?? item.법정동 ?? '').trim(),
    exclusiveArea: Number(item.excluUseAr ?? item.전용면적 ?? 0),
    price: deposit,
    floor: Number(item.floor ?? item.층 ?? 0),
    dealYear: year,
    dealMonth: month,
    dealDay: day,
    dealDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    buildYear: item.buildYear || item.건축년도 ? Number(item.buildYear ?? item.건축년도) : undefined,
    lawdCd: String(item.sggCd ?? item.지역코드 ?? lawdCd).slice(0, 5),
    dealMonthKey: dealYmd,
    monthlyRent: 0,
    kind: 'jeonse',
  };
}

async function fetchMolitItems(
  url: string,
  lawdCd: string,
  dealYmd: string,
): Promise<Record<string, unknown>[]> {
  const serviceKey = process.env.MOLIT_SERVICE_KEY;
  if (!serviceKey || serviceKey.startsWith('your_')) {
    throw new Error('MOLIT_SERVICE_KEY is not configured');
  }

  const params = new URLSearchParams({
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: '1',
    numOfRows: '1000',
    _type: 'json',
  });
  const encodedKey = /%/.test(serviceKey) ? serviceKey : encodeURIComponent(serviceKey);
  const fullUrl = `${url}?serviceKey=${encodedKey}&${params.toString()}`;

  const res = await fetch(fullUrl, {
    headers: {
      Accept: 'application/json, application/xml, */*',
      'User-Agent': 'AppNavi/1.0 (local-dev)',
    },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`MOLIT API HTTP ${res.status}${body ? `: ${body}` : ''}`);
  }

  const text = await res.text();
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const json = JSON.parse(text) as {
      response?: { body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } } };
    };
    return asArray(json.response?.body?.items?.item);
  }

  const parsed = parser.parse(text) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } };
    };
  };
  const code = parsed.response?.header?.resultCode;
  if (code && code !== '00' && code !== '000') {
    throw new Error(`MOLIT API error: ${code} ${parsed.response?.header?.resultMsg ?? ''}`);
  }
  return asArray(parsed.response?.body?.items?.item);
}

export async function fetchTradesForMonth(lawdCd: string, dealYmd: string): Promise<ApartmentTrade[]> {
  const cacheKey = `molit:sale:${lawdCd}:${dealYmd}`;
  const cached = readCachedMonth(cacheKey);
  if (cached) return cached;

  const allowMock = process.env.ALLOW_MOCK_FALLBACK !== 'false';
  const serviceKey = process.env.MOLIT_SERVICE_KEY;

  if (!serviceKey || serviceKey.startsWith('your_')) {
    if (!allowMock) throw new Error('MOLIT_SERVICE_KEY is not configured');
    const mock = mockSales(lawdCd, dealYmd);
    writeCachedMonth(cacheKey, dealYmd, mock);
    return mock;
  }

  try {
    const items = await fetchMolitItems(MOLIT_TRADE_URL, lawdCd, dealYmd);
    const trades = items
      .map((item) => normalizeSaleItem(item, lawdCd, dealYmd))
      .filter((t): t is ApartmentTrade => t !== null);
    writeCachedMonth(cacheKey, dealYmd, trades);
    return trades;
  } catch (err) {
    if (allowMock) {
      const mock = mockSales(lawdCd, dealYmd);
      writeCachedMonth(cacheKey, dealYmd, mock);
      return mock;
    }
    throw err;
  }
}

export async function fetchJeonseForMonth(lawdCd: string, dealYmd: string): Promise<ApartmentTrade[]> {
  const cacheKey = `molit:jeonse:${lawdCd}:${dealYmd}`;
  const cached = readCachedMonth(cacheKey);
  if (cached) return cached;

  const allowMock = process.env.ALLOW_MOCK_FALLBACK !== 'false';
  const serviceKey = process.env.MOLIT_SERVICE_KEY;

  if (!serviceKey || serviceKey.startsWith('your_')) {
    if (!allowMock) throw new Error('MOLIT_SERVICE_KEY is not configured');
    const mock = mockJeonse(lawdCd, dealYmd);
    writeCachedMonth(cacheKey, dealYmd, mock);
    return mock;
  }

  try {
    const items = await fetchMolitItems(MOLIT_RENT_URL, lawdCd, dealYmd);
    const rents = items
      .map((item) => normalizeJeonseItem(item, lawdCd, dealYmd))
      .filter((t): t is ApartmentTrade => t !== null);
    writeCachedMonth(cacheKey, dealYmd, rents);
    return rents;
  } catch (err) {
    if (allowMock) {
      const mock = mockJeonse(lawdCd, dealYmd);
      writeCachedMonth(cacheKey, dealYmd, mock);
      return mock;
    }
    throw err;
  }
}

export async function fetchTradesForMonths(
  lawdCd: string,
  months: string[],
  concurrency = 6,
): Promise<ApartmentTrade[]> {
  const batches = await mapPool(months, concurrency, (m) => fetchTradesForMonth(lawdCd, m));
  return batches.flat();
}

export async function fetchJeonseForMonths(
  lawdCd: string,
  months: string[],
  concurrency = 6,
): Promise<ApartmentTrade[]> {
  const batches = await mapPool(months, concurrency, (m) => fetchJeonseForMonth(lawdCd, m));
  return batches.flat();
}

export async function fetchSaleAndJeonseForMonths(
  lawdCd: string,
  months: string[],
  concurrency = 6,
): Promise<{ sales: ApartmentTrade[]; jeonse: ApartmentTrade[] }> {
  const [sales, jeonse] = await Promise.all([
    fetchTradesForMonths(lawdCd, months, concurrency),
    fetchJeonseForMonths(lawdCd, months, concurrency),
  ]);
  return { sales, jeonse };
}
