import { describe, expect, it } from 'vitest';
import {
  aggregateComplexes,
  average,
  buildYearlyComparison,
  changePercent,
  extractAreaBands,
  formatTrendSummary,
  median,
  pricePerPyeong,
  recentYearMonths,
  type ApartmentTrade,
} from '../types.js';

function trade(
  partial: Partial<ApartmentTrade> & Pick<ApartmentTrade, 'aptName' | 'price' | 'exclusiveArea'>,
): ApartmentTrade {
  return {
    dong: '중구 회현동',
    floor: 10,
    dealYear: 2026,
    dealMonth: 5,
    dealDay: 10,
    dealDate: '2026-05-10',
    lawdCd: '11140',
    dealMonthKey: '202605',
    kind: 'sale',
    ...partial,
  };
}

describe('stats helpers', () => {
  it('computes median for odd and even lengths', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('computes average and price per pyeong', () => {
    expect(average([100, 200])).toBe(150);
    expect(pricePerPyeong(10000, 33.058)).toBeCloseTo(1000, 0);
    expect(pricePerPyeong(100, 0)).toBe(0);
  });

  it('computes change percent', () => {
    expect(changePercent(100, 110)).toBeCloseTo(10);
    expect(changePercent(0, 10)).toBeNull();
  });
});

describe('aggregateComplexes', () => {
  it('groups by apt name and dong with jeonse gap', () => {
    const trades = [
      trade({
        aptName: 'A아파트',
        price: 10000,
        exclusiveArea: 84,
        dealDate: '2026-03-01',
        dealYear: 2026,
        dealMonth: 3,
      }),
      trade({
        aptName: 'A아파트',
        price: 12000,
        exclusiveArea: 84,
        dealDate: '2026-04-01',
        dealYear: 2026,
        dealMonth: 4,
      }),
      trade({
        aptName: 'B아파트',
        price: 20000,
        exclusiveArea: 59,
        dealDate: '2026-04-15',
        dealYear: 2026,
        dealMonth: 4,
      }),
    ];
    const jeonse = [
      trade({
        aptName: 'A아파트',
        price: 7000,
        exclusiveArea: 84,
        dealYear: 2026,
        dealMonth: 4,
        kind: 'jeonse',
        monthlyRent: 0,
      }),
    ];
    const result = aggregateComplexes(trades, undefined, jeonse, { yearCount: 1 });
    expect(result).toHaveLength(2);
    const a = result.find((c) => c.aptName === 'A아파트')!;
    expect(a.tradeCount).toBe(2);
    expect(a.medianPrice).toBe(11000);
    expect(a.medianJeonse).toBe(7000);
    expect(a.saleJeonseGap).toBe(4000);
    expect(a.monthly).toHaveLength(2);
  });

  it('filters by area band', () => {
    const trades = [
      trade({ aptName: 'A아파트', price: 10000, exclusiveArea: 84 }),
      trade({ aptName: 'A아파트', price: 8000, exclusiveArea: 59 }),
    ];
    const result = aggregateComplexes(trades, { target: 84, tolerance: 5 });
    expect(result[0].tradeCount).toBe(1);
    expect(result[0].medianPrice).toBe(10000);
  });
});

describe('extractAreaBands', () => {
  it('clusters exclusive areas into labeled pyeong bands', () => {
    const sales = [
      trade({ aptName: 'A', price: 10000, exclusiveArea: 84.9 }),
      trade({ aptName: 'A', price: 11000, exclusiveArea: 84.2 }),
      trade({ aptName: 'A', price: 8000, exclusiveArea: 59.8 }),
      trade({ aptName: 'A', price: 8200, exclusiveArea: 59.1 }),
    ];
    const bands = extractAreaBands(sales, []);
    expect(bands.map((b) => b.targetM2)).toEqual([59, 84]);
    expect(bands[0].label).toContain('평');
    expect(bands[1].saleCount).toBe(2);
  });
});

describe('buildYearlyComparison', () => {
  it('builds sale/jeonse/gap series', () => {
    const sales = [
      trade({ aptName: 'A', price: 10000, exclusiveArea: 84, dealYear: 2024 }),
      trade({ aptName: 'A', price: 12000, exclusiveArea: 84, dealYear: 2025 }),
    ];
    const rents = [
      trade({ aptName: 'A', price: 6000, exclusiveArea: 84, dealYear: 2024, kind: 'jeonse' }),
      trade({ aptName: 'A', price: 7000, exclusiveArea: 84, dealYear: 2025, kind: 'jeonse' }),
    ];
    const yearly = buildYearlyComparison(sales, rents, 3, new Date(2025, 6, 1));
    expect(yearly.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(yearly[1].saleMedian).toBe(10000);
    expect(yearly[1].saleMin).toBe(10000);
    expect(yearly[1].saleMax).toBe(10000);
    expect(yearly[1].jeonseMedian).toBe(6000);
    expect(yearly[1].jeonseMin).toBe(6000);
    expect(yearly[1].jeonseMax).toBe(6000);
    expect(yearly[1].gap).toBe(4000);
    expect(yearly[1].gapMin).toBe(4000);
    expect(yearly[1].gapMax).toBe(4000);
    expect(yearly[0].saleMedian).toBeNull();
    expect(yearly[0].saleMin).toBeNull();
  });

  it('tracks yearly min and max for sale and jeonse', () => {
    const sales = [
      trade({ aptName: 'A', price: 8000, exclusiveArea: 84, dealYear: 2024 }),
      trade({ aptName: 'A', price: 12000, exclusiveArea: 84, dealYear: 2024 }),
    ];
    const rents = [
      trade({ aptName: 'A', price: 5000, exclusiveArea: 84, dealYear: 2024, kind: 'jeonse' }),
      trade({ aptName: 'A', price: 7000, exclusiveArea: 84, dealYear: 2024, kind: 'jeonse' }),
    ];
    const yearly = buildYearlyComparison(sales, rents, 1, new Date(2024, 6, 1));
    expect(yearly).toHaveLength(1);
    expect(yearly[0].saleMin).toBe(8000);
    expect(yearly[0].saleMax).toBe(12000);
    expect(yearly[0].saleMedian).toBe(10000);
    expect(yearly[0].jeonseMin).toBe(5000);
    expect(yearly[0].jeonseMax).toBe(7000);
    expect(yearly[0].gapMin).toBe(1000); // 8000 - 7000
    expect(yearly[0].gapMax).toBe(7000); // 12000 - 5000
  });
});

describe('formatTrendSummary', () => {
  it('describes rising trend', () => {
    const { text, changePercent: pct } = formatTrendSummary(
      [
        { month: '2026-03', avgPrice: 100, medianPrice: 100, tradeCount: 2 },
        { month: '2026-04', avgPrice: 110, medianPrice: 110, tradeCount: 3 },
      ],
      5,
    );
    expect(pct).toBeCloseTo(10);
    expect(text).toContain('100만');
    expect(text).toContain('110만');
    expect(text).toContain('거래 5건');
  });
});

describe('recentYearMonths', () => {
  it('returns YYYYMM keys going backwards', () => {
    const months = recentYearMonths(3, new Date(2026, 6, 15));
    expect(months).toEqual(['202607', '202606', '202605']);
  });
});
