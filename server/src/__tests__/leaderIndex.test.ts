import { describe, expect, it } from 'vitest';
import {
  buildLeaderIndexFromTrades,
  detectSurgeIntervals,
  pricePerPyeong,
  type LeaderMonthPoint,
} from '../services/leaderIndex.js';
import type { ApartmentTrade } from '../types.js';

function trade(
  aptName: string,
  dong: string,
  year: number,
  month: number,
  price: number,
  kind: 'sale' | 'jeonse' = 'sale',
  exclusiveArea = 84,
): ApartmentTrade {
  const dealMonthKey = `${year}${String(month).padStart(2, '0')}`;
  return {
    aptName,
    dong,
    exclusiveArea,
    price,
    floor: 10,
    dealYear: year,
    dealMonth: month,
    dealDay: 15,
    dealDate: `${year}-${String(month).padStart(2, '0')}-15`,
    lawdCd: '11680',
    dealMonthKey,
    kind,
    monthlyRent: kind === 'jeonse' ? 0 : undefined,
  };
}

describe('pricePerPyeong', () => {
  it('converts 만원 absolute price to 만원/평', () => {
    expect(pricePerPyeong(10000, 33.058)).toBeCloseTo(1000, 0);
  });
});

describe('detectSurgeIntervals', () => {
  it('marks consecutive MoM jumps above threshold', () => {
    const monthly: LeaderMonthPoint[] = [
      { month: '2024-01', avgMedian: 1000, sampleCount: 3, momChangePercent: null },
      { month: '2024-02', avgMedian: 1010, sampleCount: 3, momChangePercent: 1 },
      { month: '2024-03', avgMedian: 1060.5, sampleCount: 3, momChangePercent: 5 },
      { month: '2024-04', avgMedian: 1113.5, sampleCount: 3, momChangePercent: 5 },
      { month: '2024-05', avgMedian: 1115, sampleCount: 3, momChangePercent: 0.1 },
    ];
    const surges = detectSurgeIntervals(monthly, 3);
    expect(surges.length).toBeGreaterThanOrEqual(1);
    expect(surges[0].startMonth).toBe('2024-02');
    expect(surges[0].changePercent).toBeGreaterThan(3);
  });
});

describe('buildLeaderIndexFromTrades', () => {
  it('ranks by 평단가 within area band and builds sale/jeonse/gap series', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const sales: ApartmentTrade[] = [];
    const jeonse: ApartmentTrade[] = [];

    for (let i = 0; i < 12; i++) {
      let month = m - i;
      let year = y;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      // Same absolute price but different area → different 평단가
      sales.push(trade('비싼평단', '역삼동', year, month, 200000, 'sale', 84));
      sales.push(trade('싼평단', '개포동', year, month, 200000, 'sale', 134));
      jeonse.push(trade('비싼평단', '역삼동', year, month, 120000, 'jeonse', 84));
      jeonse.push(trade('싼평단', '개포동', year, month, 100000, 'jeonse', 134));
    }

    const result = buildLeaderIndexFromTrades(sales, jeonse, {
      topN: 2,
      years: 1,
      surgeThresholdPercent: 3,
      minRankingTrades: 3,
      areaTarget: 84,
      areaTolerance: 7,
    });

    expect(result.areaTarget).toBe(84);
    expect(result.metric).toBe('pyeong');
    expect(result.leaders.length).toBeGreaterThanOrEqual(1);
    expect(result.leaders[0].aptName).toBe('비싼평단');
    expect(result.monthlySale.some((p) => p.avgMedian != null)).toBe(true);
    expect(result.monthlyJeonse.some((p) => p.avgMedian != null)).toBe(true);
    expect(result.monthlyGap.some((p) => p.avgMedian != null)).toBe(true);
  });
});
