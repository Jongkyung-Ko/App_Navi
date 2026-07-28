import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearTradeStoreCache, readStoreMonth } from '../services/tradeStore.js';

describe('tradeStore', () => {
  const prev = process.env.MOLIT_STORE_DIR;
  let tmp: string;

  afterEach(() => {
    clearTradeStoreCache();
    if (prev === undefined) delete process.env.MOLIT_STORE_DIR;
    else process.env.MOLIT_STORE_DIR = prev;
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('reads normalized jsonl month buckets', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'molit-store-'));
    const file = path.join(tmp, '11680', 'sale', '202401.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `${JSON.stringify({
        lawdCd: '11680',
        aptName: '테스트아파트',
        dong: '역삼동',
        jibun: '123',
        exclusiveArea: 84.5,
        price: 200000,
        floor: 10,
        dealYear: 2024,
        dealMonth: 1,
        dealDay: 15,
        dealDate: '2024-01-15',
        dealMonthKey: '202401',
        buildYear: 2010,
        kind: 'sale',
        monthlyRent: null,
      })}\n`,
      'utf8',
    );

    process.env.MOLIT_STORE_DIR = tmp;
    clearTradeStoreCache();
    const rows = readStoreMonth('11680', 'sale', '202401');
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].aptName).toBe('테스트아파트');
    expect(rows![0].price).toBe(200000);
    expect(readStoreMonth('11680', 'sale', '202402')).toBeNull();
  });
});
