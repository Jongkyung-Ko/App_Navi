import type { ComplexSummary, NearbySearchScope } from '../types';

export type NearbyCacheEntry = {
  lawdCd: string;
  areaTarget: number | undefined;
  scope: NearbySearchScope;
  radiusKm: number | undefined;
  complexes: ComplexSummary[];
  areaBands: number[];
};

const store = new Map<string, NearbyCacheEntry>();

export function nearbyCacheKey(
  lawdCd: string,
  areaTarget: number | undefined,
  scope: NearbySearchScope = 'sigungu',
  radiusKm?: number,
): string {
  const radiusPart = scope === 'radius' ? String(radiusKm ?? 1) : 'none';
  return `${lawdCd}:${areaTarget ?? 'all'}:${scope}:${radiusPart}`;
}

export function getNearbyCache(
  lawdCd: string,
  areaTarget: number | undefined,
  scope: NearbySearchScope = 'sigungu',
  radiusKm?: number,
): NearbyCacheEntry | undefined {
  return store.get(nearbyCacheKey(lawdCd, areaTarget, scope, radiusKm));
}

export function setNearbyCache(entry: NearbyCacheEntry): void {
  store.set(
    nearbyCacheKey(entry.lawdCd, entry.areaTarget, entry.scope, entry.radiusKm),
    entry,
  );
}
