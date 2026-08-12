import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTradeStoreCache } from '../services/tradeStore.js';

describe('molit soft-fail when live API is down', () => {
  let tmpStore: string;
  let tmpCache: string;
  let prevMock: string | undefined;
  let prevKey: string | undefined;
  let prevStoreDir: string | undefined;
  let prevCacheDir: string | undefined;

  beforeEach(() => {
    prevMock = process.env.ALLOW_MOCK_FALLBACK;
    prevKey = process.env.MOLIT_SERVICE_KEY;
    prevStoreDir = process.env.MOLIT_STORE_DIR;
    prevCacheDir = process.env.CACHE_DIR;

    tmpStore = fs.mkdtempSync(path.join(os.tmpdir(), 'app-navi-store-'));
    tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), 'app-navi-cache-'));
    process.env.ALLOW_MOCK_FALLBACK = 'false';
    process.env.MOLIT_SERVICE_KEY = 'test-key-not-mock';
    process.env.MOLIT_STORE_DIR = tmpStore;
    process.env.CACHE_DIR = tmpCache;
    clearTradeStoreCache();

    const saleDir = path.join(tmpStore, '11140', 'sale');
    fs.mkdirSync(saleDir, { recursive: true });
    fs.writeFileSync(
      path.join(saleDir, '202607.jsonl'),
      `${JSON.stringify({
        lawdCd: '11140',
        aptName: '스토어아파트',
        dong: '회현동',
        exclusiveArea: 84.9,
        price: 100000,
        floor: 10,
        dealYear: 2026,
        dealMonth: 7,
        dealDay: 1,
        dealDate: '2026-07-01',
        dealMonthKey: '202607',
        kind: 'sale',
      })}\n`,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    clearTradeStoreCache();
    if (prevMock === undefined) delete process.env.ALLOW_MOCK_FALLBACK;
    else process.env.ALLOW_MOCK_FALLBACK = prevMock;
    if (prevKey === undefined) delete process.env.MOLIT_SERVICE_KEY;
    else process.env.MOLIT_SERVICE_KEY = prevKey;
    if (prevStoreDir === undefined) delete process.env.MOLIT_STORE_DIR;
    else process.env.MOLIT_STORE_DIR = prevStoreDir;
    if (prevCacheDir === undefined) delete process.env.CACHE_DIR;
    else process.env.CACHE_DIR = prevCacheDir;
    fs.rmSync(tmpStore, { recursive: true, force: true });
    fs.rmSync(tmpCache, { recursive: true, force: true });
  });

  it('returns store months and empty for failed live months instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    );

    const { fetchSaleAndJeonseForMonths } = await import('../services/molit.js');
    const { sales } = await fetchSaleAndJeonseForMonths('11140', ['202608', '202607'], 2);

    expect(sales.some((t) => t.aptName === '스토어아파트' && t.dealMonthKey === '202607')).toBe(
      true,
    );
    expect(sales.filter((t) => t.dealMonthKey === '202608')).toHaveLength(0);
  });
});
