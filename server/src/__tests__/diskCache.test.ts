import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diskCacheGet,
  diskCacheSet,
  molitMonthTtlSeconds,
} from '../services/diskCache.js';

describe('diskCache', () => {
  let tmp: string;
  let prevCacheDir: string | undefined;

  beforeEach(() => {
    prevCacheDir = process.env.CACHE_DIR;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'app-navi-cache-'));
    process.env.CACHE_DIR = tmp;
  });

  afterEach(() => {
    if (prevCacheDir === undefined) delete process.env.CACHE_DIR;
    else process.env.CACHE_DIR = prevCacheDir;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('molitMonthTtlSeconds keeps historical months longer', () => {
    const from = new Date(2026, 6, 15); // Jul 2026
    expect(molitMonthTtlSeconds('202607', from)).toBe(6 * 3600);
    expect(molitMonthTtlSeconds('202606', from)).toBe(6 * 3600);
    expect(molitMonthTtlSeconds('202604', from)).toBe(24 * 3600);
    expect(molitMonthTtlSeconds('202001', from)).toBe(30 * 24 * 3600);
  });

  it('persists and reads values until expiry', () => {
    diskCacheSet('molit:sale:11110:202401', [{ price: 1 }], 3600);
    const hit = diskCacheGet<{ price: number }[]>('molit:sale:11110:202401');
    expect(hit).toEqual([{ price: 1 }]);
  });
});
