import NodeCache from 'node-cache';

const ttl = Number(process.env.CACHE_TTL_SECONDS ?? 21600);

export const cache = new NodeCache({
  stdTTL: ttl,
  checkperiod: Math.min(600, Math.max(60, Math.floor(ttl / 10))),
  useClones: false,
});

export function cacheGet<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function cacheSet<T>(key: string, value: T, ttlSeconds?: number): void {
  if (ttlSeconds !== undefined) {
    cache.set(key, value, ttlSeconds);
  } else {
    cache.set(key, value);
  }
}
