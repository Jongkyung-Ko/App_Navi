import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RADIUS_KM_OPTIONS,
  type NearbySearchScope,
  type NearbySearchSettings,
} from '../types';

const STORAGE_KEY = 'appnavi.nearbySearch.v1';

export const DEFAULT_NEARBY_SETTINGS: NearbySearchSettings = {
  scope: 'sigungu',
  radiusKm: 1,
};

function normalizeRadiusKm(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_NEARBY_SETTINGS.radiusKm;
  const nearest = RADIUS_KM_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - n) < Math.abs(best - n) ? opt : best,
  );
  return nearest;
}

function normalizeSettings(raw: unknown): NearbySearchSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NEARBY_SETTINGS };
  const obj = raw as Partial<NearbySearchSettings>;
  const scope: NearbySearchScope = obj.scope === 'radius' ? 'radius' : 'sigungu';
  return {
    scope,
    radiusKm: normalizeRadiusKm(obj.radiusKm),
  };
}

export async function loadNearbySettings(): Promise<NearbySearchSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NEARBY_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_NEARBY_SETTINGS };
  }
}

export async function saveNearbySettings(
  next: NearbySearchSettings,
): Promise<NearbySearchSettings> {
  const normalized = normalizeSettings(next);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function formatRadiusLabel(radiusKm: number): string {
  return Number.isInteger(radiusKm) ? `${radiusKm}km` : `${radiusKm}km`;
}

export function scopeLabel(settings: NearbySearchSettings): string {
  if (settings.scope === 'radius') {
    return `내 위치 반경 ${formatRadiusLabel(settings.radiusKm)}`;
  }
  return '시군구(구·시·군)';
}
