import type { ComplexSummary } from '../types';

export type NearbyCacheEntry = {
  lawdCd: string;
  areaTarget: number | undefined;
  complexes: ComplexSummary[];
  areaBands: number[];
};

const store = new Map<string, NearbyCacheEntry>();

export function nearbyCacheKey(lawdCd: string, areaTarget: number | undefined): string {
  return `${lawdCd}:${areaTarget ?? 'all'}`;
}

export function getNearbyCache(
  lawdCd: string,
  areaTarget: number | undefined,
): NearbyCacheEntry | undefined {
  return store.get(nearbyCacheKey(lawdCd, areaTarget));
}

export function setNearbyCache(entry: NearbyCacheEntry): void {
  store.set(nearbyCacheKey(entry.lawdCd, entry.areaTarget), entry);
}
