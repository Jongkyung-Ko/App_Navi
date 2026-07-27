import type { ReverseGeocodeResult } from '../types.js';
import { cacheGet, cacheSet } from './cache.js';
import { resolveSigunguFromRegions } from './sigungu.js';

const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local';

interface KakaoAddressDoc {
  address?: {
    address_name?: string;
    region_1depth_name?: string;
    region_2depth_name?: string;
    region_3depth_name?: string;
    b_code?: string;
  };
  road_address?: {
    address_name?: string;
    region_1depth_name?: string;
    region_2depth_name?: string;
    region_3depth_name?: string;
  };
}

interface KakaoRegionDoc {
  region_type: string;
  code: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
}

function mockGeocode(lat: number, lng: number): ReverseGeocodeResult {
  return {
    roadAddress: '서울특별시 중구 세종대로 110',
    jibunAddress: '서울특별시 중구 태평로1가 31',
    region1: '서울특별시',
    region2: '중구',
    region3: '태평로1가',
    lawdCd: '11140',
    sigunguLabel: '서울특별시 중구',
    lat,
    lng,
    mock: true,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // Same 시군구 neighborhood shares cache; MOLIT queries are always by 5-digit LAWD_CD
  const cacheKey = `geo:sgg:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet<ReverseGeocodeResult>(cacheKey);
  if (cached) return cached;

  const key = process.env.KAKAO_REST_KEY;
  const allowMock = process.env.ALLOW_MOCK_FALLBACK !== 'false';

  if (!key || key.startsWith('your_')) {
    if (!allowMock) {
      throw new Error('KAKAO_REST_KEY is not configured');
    }
    const mock = mockGeocode(lat, lng);
    cacheSet(cacheKey, mock, 300);
    return mock;
  }

  const headers = { Authorization: `KakaoAK ${key}` };

  const [addrRes, regionRes] = await Promise.all([
    fetch(`${KAKAO_LOCAL_BASE}/geo/coord2address.json?x=${lng}&y=${lat}`, { headers }),
    fetch(`${KAKAO_LOCAL_BASE}/geo/coord2regioncode.json?x=${lng}&y=${lat}`, { headers }),
  ]);

  if (!addrRes.ok) {
    const text = await addrRes.text();
    throw new Error(`Kakao coord2address failed: ${addrRes.status} ${text}`);
  }
  if (!regionRes.ok) {
    const text = await regionRes.text();
    throw new Error(`Kakao coord2regioncode failed: ${regionRes.status} ${text}`);
  }

  const addrJson = (await addrRes.json()) as { documents?: KakaoAddressDoc[] };
  const regionJson = (await regionRes.json()) as { documents?: KakaoRegionDoc[] };
  const docs = regionJson.documents ?? [];
  const doc = addrJson.documents?.[0];

  let resolved;
  try {
    resolved = resolveSigunguFromRegions(docs);
  } catch {
    const fallbackCode = (doc?.address?.b_code ?? '').replace(/\D/g, '').slice(0, 5);
    if (fallbackCode.length !== 5) {
      throw new Error('Failed to resolve 시군구(LAWD_CD) from coordinates');
    }
    const region1 = doc?.address?.region_1depth_name ?? '';
    const region2 = doc?.address?.region_2depth_name ?? '';
    resolved = {
      lawdCd: fallbackCode,
      region1,
      region2,
      region3: doc?.address?.region_3depth_name ?? '',
      sigunguLabel: [region1, region2].filter(Boolean).join(' ') || fallbackCode,
    };
  }

  const result: ReverseGeocodeResult = {
    roadAddress: doc?.road_address?.address_name ?? null,
    jibunAddress: doc?.address?.address_name ?? null,
    region1: resolved.region1,
    region2: resolved.region2,
    region3: resolved.region3,
    lawdCd: resolved.lawdCd,
    sigunguLabel: resolved.sigunguLabel,
    lat,
    lng,
  };

  cacheSet(cacheKey, result);
  return result;
}

export async function searchPlaceKeyword(
  query: string,
  lat?: number,
  lng?: number,
): Promise<{ lat: number; lng: number; placeName: string } | null> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key || key.startsWith('your_')) return null;

  const params = new URLSearchParams({ query, size: '1' });
  if (lat !== undefined && lng !== undefined) {
    params.set('y', String(lat));
    params.set('x', String(lng));
    params.set('radius', '5000');
  }

  const res = await fetch(`${KAKAO_LOCAL_BASE}/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    documents?: Array<{ place_name: string; y: string; x: string }>;
  };
  const hit = json.documents?.[0];
  if (!hit) return null;
  return { placeName: hit.place_name, lat: Number(hit.y), lng: Number(hit.x) };
}
