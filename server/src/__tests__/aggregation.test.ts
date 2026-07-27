import { describe, expect, it } from 'vitest';
import {
  aggregateComplexes,
  average,
  changePercent,
  formatTrendSummary,
  median,
  pricePerPyeong,
  recentYearMonths,
  type ApartmentTrade,
} from '../types.js';

function trade(partial: Partial<ApartmentTrade> & Pick<ApartmentTrade, 'aptName' | 'price' | 'exclusiveArea'>): ApartmentTrade {
  return {
    dong: '중구 회현동',
    floor: 10,
    dealYear: 2026,
    dealMonth: 5,
    dealDay: 10,
    dealDate: '2026-05-10',
    lawdCd: '11140',
    dealMonthKey: '202605',
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
  it('groups by apt name and dong', () => {
    const trades = [
      trade({ aptName: 'A아파트', price: 10000, exclusiveArea: 84, dealDate: '2026-03-01', dealYear: 2026, dealMonth: 3 }),
      trade({ aptName: 'A아파트', price: 12000, exclusiveArea: 84, dealDate: '2026-04-01', dealYear: 2026, dealMonth: 4 }),
      trade({ aptName: 'B아파트', price: 20000, exclusiveArea: 59, dealDate: '2026-04-15', dealYear: 2026, dealMonth: 4 }),
    ];
    const result = aggregateComplexes(trades);
    expect(result).toHaveLength(2);
    const a = result.find((c) => c.aptName === 'A아파트')!;
    expect(a.tradeCount).toBe(2);
    expect(a.medianPrice).toBe(11000);
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
    const months = recentYearMonths(3, new Date(2026, 6, 15)); // Jul 2026
    expect(months).toEqual(['202607', '202606', '202605']);
  });
});
