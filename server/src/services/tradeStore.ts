import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import type { ApartmentTrade } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type StoreKind = 'sale' | 'jeonse';

interface StoreRow {
  lawdCd: string;
  aptName: string;
  dong: string;
  jibun?: string | null;
  exclusiveArea: number;
  price: number;
  floor?: number | null;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string;
  dealMonthKey: string;
  buildYear?: number | null;
  kind: StoreKind;
  monthlyRent?: number | null;
}

const monthCache = new Map<string, ApartmentTrade[]>();
let resolvedDir: string | null | undefined;

function candidateDirs(): string[] {
  return [
    path.resolve(process.cwd(), 'data/molit-store/normalized'),
    path.resolve(process.cwd(), '../data/molit-store/normalized'),
    path.resolve(__dirname, '../../../data/molit-store/normalized'),
    path.resolve(__dirname, '../../data/molit-store/normalized'),
  ];
}

function candidateArchives(): string[] {
  return [
    path.resolve(process.cwd(), 'data/molit-store/seoul-normalized.tgz'),
    path.resolve(process.cwd(), '../data/molit-store/seoul-normalized.tgz'),
    path.resolve(__dirname, '../../../data/molit-store/seoul-normalized.tgz'),
    path.resolve(__dirname, '../../data/molit-store/seoul-normalized.tgz'),
  ];
}

/** Unpack packed store archive once when normalized/ is missing. */
export function ensureTradeStoreReady(): string | null {
  const existing = candidateDirs().find((d) => fs.existsSync(d));
  if (existing) {
    resolvedDir = existing;
    return existing;
  }

  const archive = candidateArchives().find((p) => fs.existsSync(p));
  if (!archive) {
    resolvedDir = null;
    return null;
  }

  const targetRoot = path.dirname(archive);
  const target = path.join(targetRoot, 'normalized');
  fs.mkdirSync(targetRoot, { recursive: true });
  console.info(`[trade-store] extracting ${archive} → ${targetRoot}`);
  execFileSync('tar', ['-xzf', archive, '-C', targetRoot], { stdio: 'inherit' });
  if (!fs.existsSync(target)) {
    resolvedDir = null;
    return null;
  }
  resolvedDir = target;
  return target;
}

export function getTradeStoreDir(): string | null {
  // Env always wins (also makes unit tests deterministic).
  if (process.env.MOLIT_STORE_DIR) {
    const d = path.resolve(process.env.MOLIT_STORE_DIR);
    return fs.existsSync(d) ? d : null;
  }
  if (resolvedDir !== undefined) return resolvedDir;
  return ensureTradeStoreReady();
}

/** Test helper */
export function clearTradeStoreCache(): void {
  monthCache.clear();
  resolvedDir = undefined;
}

export function getTradeStoreInfo(): {
  ready: boolean;
  dir: string | null;
  lawdCount: number;
} {
  const dir = getTradeStoreDir();
  if (!dir || !fs.existsSync(dir)) {
    return { ready: false, dir: null, lawdCount: 0 };
  }
  const lawdCount = fs.readdirSync(dir).filter((name) => /^\d{5}$/.test(name)).length;
  return { ready: lawdCount > 0, dir, lawdCount };
}

function monthPath(lawdCd: string, kind: StoreKind, dealYmd: string): string | null {
  const dir = getTradeStoreDir();
  if (!dir) return null;
  return path.join(dir, lawdCd, kind, `${dealYmd}.jsonl`);
}

export function hasStoreMonth(lawdCd: string, kind: StoreKind, dealYmd: string): boolean {
  const p = monthPath(lawdCd, kind, dealYmd);
  return Boolean(p && fs.existsSync(p));
}

function toTrade(row: StoreRow): ApartmentTrade | null {
  if (!row?.aptName || !row.lawdCd || !row.dealMonthKey) return null;
  if (!Number.isFinite(row.price) || row.price <= 0) return null;
  if (!Number.isFinite(row.exclusiveArea) || row.exclusiveArea <= 0) return null;
  return {
    aptName: String(row.aptName).trim(),
    dong: String(row.dong ?? '').trim(),
    jibun: row.jibun ? String(row.jibun) : undefined,
    exclusiveArea: Number(row.exclusiveArea),
    price: Number(row.price),
    floor: row.floor == null || !Number.isFinite(row.floor) ? 0 : Number(row.floor),
    dealYear: Number(row.dealYear),
    dealMonth: Number(row.dealMonth),
    dealDay: Number(row.dealDay),
    dealDate: String(row.dealDate),
    buildYear: row.buildYear == null ? undefined : Number(row.buildYear),
    lawdCd: String(row.lawdCd),
    dealMonthKey: String(row.dealMonthKey),
    monthlyRent: row.kind === 'jeonse' ? Number(row.monthlyRent ?? 0) : undefined,
    kind: row.kind,
  };
}

/** Read one month from the file store. null = not in store (caller should live-fetch). */
export function readStoreMonth(
  lawdCd: string,
  kind: StoreKind,
  dealYmd: string,
): ApartmentTrade[] | null {
  if (!/^\d{5}$/.test(lawdCd) || !/^\d{6}$/.test(dealYmd)) return null;
  const file = monthPath(lawdCd, kind, dealYmd);
  if (!file || !fs.existsSync(file)) return null;

  const cacheKey = `${file}`;
  const hit = monthCache.get(cacheKey);
  if (hit) return hit;

  const text = fs.readFileSync(file, 'utf8');
  const trades: ApartmentTrade[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as StoreRow;
      const trade = toTrade(row);
      if (trade) trades.push(trade);
    } catch {
      // skip bad line
    }
  }
  monthCache.set(cacheKey, trades);
  return trades;
}
