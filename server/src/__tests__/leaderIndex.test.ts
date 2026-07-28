import { describe, expect, it } from 'vitest';
import {
  buildLeaderIndexFromSales,
  detectSurgeIntervals,
  type LeaderMonthPoint,
} from '../services/leaderIndex.js';
import type { ApartmentTrade } from '../types.js';

function trade(
  aptName: string,
  dong: string,
  year: number,
  month: number,
  price: number,
): ApartmentTrade {
  const dealMonthKey = `${year}${String(month).padStart(2, '0')}`;
  return {
    aptName,
    dong,
    exclusiveArea: 84,
    price,
    floor: 10,
    dealYear: year,
    dealMonth: month,
    dealDay: 15,
    dealDate: `${year}-${String(month).padStart(2, '0')}-15`,
    lawdCd: '11680',
    dealMonthKey,
    kind: 'sale',
  };
}

describe('detectSurgeIntervals', () => {
  it('marks consecutive MoM jumps above threshold', () => {
    const monthly: LeaderMonthPoint[] = [
      { month: '2024-01', avgMedian: 100000, sampleCount: 3, momChangePercent: null },
      { month: '2024-02', avgMedian: 101000, sampleCount: 3, momChangePercent: 1 },
      { month: '2024-03', avgMedian: 106050, sampleCount: 3, momChangePercent: 5 },
      { month: '2024-04', avgMedian: 111352, sampleCount: 3, momChangePercent: 5 },
      { month: '2024-05', avgMedian: 111500, sampleCount: 3, momChangePercent: 0.1 },
    ];
    const surges = detectSurgeIntervals(monthly, 3);
    expect(surges.length).toBeGreaterThanOrEqual(1);
    expect(surges[0].startMonth).toBe('2024-02');
    expect(surges[0].changePercent).toBeGreaterThan(3);
  });
});

describe('buildLeaderIndexFromSales', () => {
  it('ranks by recent median and averages leader monthly prices', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const sales: ApartmentTrade[] = [];

    for (let i = 0; i < 12; i++) {
      let month = m - i;
      let year = y;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      sales.push(trade('비싼아파트', '역삼동', year, month, 200000 + i * 100));
      sales.push(trade('중간아파트', '대치동', year, month, 150000 + i * 50));
      sales.push(trade('싼아파트', '개포동', year, month, 100000 + i * 20));
    }

    // Add a surge month for 비싼아파트
    let surgeMonth = m - 1;
    let surgeYear = y;
    if (surgeMonth <= 0) {
      surgeMonth += 12;
      surgeYear -= 1;
    }
    sales.push(trade('비싼아파트', '역삼동', surgeYear, surgeMonth, 230000));

    const result = buildLeaderIndexFromSales(sales, {
      topN: 2,
      years: 1,
      surgeThresholdPercent: 3,
      minRankingTrades: 3,
    });

    expect(result.leaders).toHaveLength(2);
    expect(result.leaders[0].aptName).toBe('비싼아파트');
    expect(result.monthly.some((p) => p.avgMedian != null)).toBe(true);
  });
});
