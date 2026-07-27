import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveCacheRoot(): string {
  if (process.env.CACHE_DIR) return path.resolve(process.env.CACHE_DIR);
  return path.resolve(__dirname, '../../.cache');
}

type DiskEntry<T> = {
  expiresAt: number;
  data: T;
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function filePathForKey(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(resolveCacheRoot(), `${safe}.json`);
}

/** TTL for MOLIT month buckets: recent months refresh sooner; older months stay longer. */
export function molitMonthTtlSeconds(dealYmd: string, from = new Date()): number {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return Number(process.env.CACHE_TTL_SECONDS ?? 21600);
  }
  const monthsAgo =
    (from.getFullYear() - year) * 12 + (from.getMonth() + 1 - month);
  if (monthsAgo <= 1) return 6 * 3600; // current + previous month
  if (monthsAgo <= 3) return 24 * 3600;
  return 30 * 24 * 3600; // historical months rarely change
}

export function diskCacheGet<T>(key: string): T | undefined {
  try {
    const fp = filePathForKey(key);
    if (!fs.existsSync(fp)) return undefined;
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = JSON.parse(raw) as DiskEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') return undefined;
    if (Date.now() > parsed.expiresAt) {
      fs.unlinkSync(fp);
      return undefined;
    }
    return parsed.data;
  } catch {
    return undefined;
  }
}

export function diskCacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  try {
    ensureDir(resolveCacheRoot());
    const fp = filePathForKey(key);
    const entry: DiskEntry<T> = {
      expiresAt: Date.now() + Math.max(60, ttlSeconds) * 1000,
      data: value,
    };
    fs.writeFileSync(fp, JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn('[diskCache] write failed', key, err instanceof Error ? err.message : err);
  }
}

export function getDiskCacheRoot(): string {
  return resolveCacheRoot();
}
