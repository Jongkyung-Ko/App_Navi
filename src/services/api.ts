import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ComplexSummary, ReverseGeocodeResult, TradesResponse } from '../types';

function resolveApiBase(): string {
  // Set at build time for production (empty string = same-origin).
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_BASE_URL !== undefined) {
    return String(process.env.EXPO_PUBLIC_API_BASE_URL).replace(/\/$/, '');
  }

  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (extra?.apiBaseUrl) return extra.apiBaseUrl.replace(/\/$/, '');

  // Android emulator reaches host machine via 10.0.2.2
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
}

export const API_BASE_URL = resolveApiBase();

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 20000;
  const { timeoutMs: _ignored, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(fetchInit.headers ?? {}),
      },
    });
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }
    return json;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('서버 응답 시간이 초과되었습니다. 네트워크를 확인해 주세요.');
    }
    if (err instanceof TypeError) {
      throw new Error('서버에 연결할 수 없습니다. 프록시(server)가 실행 중인지 확인해 주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  kakaoReady: boolean;
  molitReady: boolean;
  mockFallback: boolean;
}> {
  return request('/health');
}

export async function fetchKakaoJsKey(): Promise<string | null> {
  const cfg = await request<{ kakaoJsKey: string | null }>('/api/config');
  return cfg.kakaoJsKey;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  return request(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
}

export async function fetchNearbyComplexes(params: {
  lawdCd: string;
  months?: number;
  q?: string;
  areaTarget?: number;
  enrichCoords?: boolean;
  lat?: number;
  lng?: number;
}): Promise<TradesResponse> {
  const search = new URLSearchParams({
    lawdCd: params.lawdCd,
    months: String(params.months ?? 3),
  });
  if (params.q) search.set('q', params.q);
  if (params.areaTarget) search.set('areaTarget', String(params.areaTarget));
  if (params.enrichCoords) search.set('enrichCoords', 'true');
  if (params.lat !== undefined) search.set('lat', String(params.lat));
  if (params.lng !== undefined) search.set('lng', String(params.lng));
  return request(`/api/trades?${search.toString()}`);
}

export async function fetchComplexDetail(params: {
  lawdCd: string;
  aptName: string;
  dong?: string;
  years?: number;
  areaTarget?: number;
}): Promise<{ complex: ComplexSummary; months: string[]; years: number }> {
  const search = new URLSearchParams({
    lawdCd: params.lawdCd,
    aptName: params.aptName,
    years: String(params.years ?? 10),
  });
  if (params.dong) search.set('dong', params.dong);
  if (params.areaTarget) search.set('areaTarget', String(params.areaTarget));
  return request(`/api/trades/complex?${search.toString()}`, { timeoutMs: 120000 });
}
